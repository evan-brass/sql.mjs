import { OutOfMemError, Trait } from './util.mjs';
import { default as sqlite_initialized, main_ptr, sqlite3, mem8, memdv, read_str, alloc_str, encoder, decoder, handle_error, vfs_impls, file_impls } from './sqlite.mjs';
import {
	SQLITE_ROW, SQLITE_DONE,
	SQLITE_OPEN_URI, SQLITE_OPEN_CREATE, SQLITE_OPEN_EXRESCODE, SQLITE_OPEN_READWRITE,
	SQLITE_FCNTL_VFS_POINTER, SQLITE_FCNTL_FILE_POINTER,
	SQLITE_INTEGER, SQLITE_FLOAT, SQLITE3_TEXT, SQLITE_BLOB, SQLITE_NULL
} from "./sqlite_def.mjs";

export const SqlCommand = new Trait("This trait marks special commands which can be used inside template literals tagged with the Conn.sql tag.");

export function backup(dest, props) {
	return {
		async [SqlCommand](src) {
			for await (const {remaining, count} of src.backup(dest, props)) {
				console.log('backup', remaining, '/', count);
			}
		}
	};
}

export class OpenParams {
	pathname = ":memory:";
	flags = SQLITE_OPEN_URI | SQLITE_OPEN_CREATE | SQLITE_OPEN_EXRESCODE | SQLITE_OPEN_READWRITE
	vfs = "";
	async [SqlCommand](conn) {
		await conn.open(this);
	}
}
// This function doesn't actually open a database, it just fills out an OpenParams object from a template
export function open(strings, ...args) {
	let seen_int = false;
	const ret = new OpenParams();
	ret.pathname = strings[0];
	for (let i = 0; i < args.length; ++i) {
		ret.pathname += strings[i + 1];
		const arg = args[i];
		if (typeof arg == 'number') {
			if (!seen_int) {
				ret.flags = 0;
				seen_int = true;
			}
			ret.flags |= arg;
		}
		else if (typeof arg == 'string') {
			ret.vfs = arg;
		}
	}
	return ret;
}

function is_safe(int) {
	return (BigInt(Number.MIN_SAFE_INTEGER) < int) &&
		(int < BigInt(Number.MAX_SAFE_INTEGER));
}
class Bindings {
	inner = [];
	strings_from_args(strings, args) {
		let ret = strings[0];
		for (let i = 0; i < args.length; ++i) {
			const arg = args[i];
			this.inner.push(arg);
			if ((typeof arg != 'object' && typeof arg != 'function') || arg instanceof ArrayBuffer || ArrayBuffer.isView(arg)) {
				ret += '?';
			}
			ret += strings[i + 1];
		}
		return ret;
	}
	next_anon() {
		for (let i = 0; i < this.inner.length; ++i) {
			const arg = this.inner[i];
			if ((typeof arg != 'object' && typeof arg != 'function') || arg instanceof ArrayBuffer || ArrayBuffer.isView(arg)) {
				return this.inner.splice(i, 1)[0];
			}
		}
	}
	next_named() {
		for (let i = 0; i < this.inner.length; ++i) {
			const arg = this.inner[i];
			if (typeof arg == 'object' && !(arg instanceof ArrayBuffer) && !ArrayBuffer.isView(arg) && !(arg instanceof SqlCommand)) {
				return this.inner.splice(i, 1)[0];
			}
		}
	}
	command() {
		if (this.inner[0] instanceof SqlCommand) {
			return this.inner.shift();
		}
	}
	bind(stmt) {
		const num_params = sqlite3.sqlite3_bind_parameter_count(stmt);
		let named;
		for (let i = 1; i <= num_params; ++i) {
			const name_ptr = sqlite3.sqlite3_bind_parameter_name(stmt, i);
			let arg;
			if (name_ptr == 0) {
				arg = this.next_anon();
			} else {
				const name = read_str(name_ptr);
				const key = name.slice(1);
				named ??= this.next_named();
				arg = named[key]
			}
			const kind = typeof arg;
			if (kind == 'boolean') {
				arg = Number(arg);
			}
			if (arg instanceof ArrayBuffer) {
				arg = new Uint8Array(arg);
			}
			if (arg === null || typeof arg == 'undefined') {
				sqlite3.sqlite3_bind_null(stmt, i);
			}
			else if (kind == 'bigint') {
				sqlite3.sqlite3_bind_int64(stmt, i, arg);
			}
			else if (kind == 'number') {
				sqlite3.sqlite3_bind_double(stmt, i, arg);
			}
			else if (kind == 'string') {
				const encoded = encoder.encode(arg);
				const ptr = sqlite3.malloc(encoded.byteLength);
				if (!ptr) throw new OutOfMemError();
				mem8(ptr, encoded.byteLength).set(encoded);
				sqlite3.sqlite3_bind_text(stmt, i, ptr, encoded.byteLength, sqlite3.free_ptr());
			}
			else if (ArrayBuffer.isView(arg)) {
				const ptr = sqlite3.malloc(arg.byteLength);
				if (!ptr) throw new OutOfMemError();
				mem8(ptr, arg.byteLength).set(new Uint8Array(arg.buffer, arg.byteOffset, arg.byteLength));
				sqlite3.sqlite3_bind_blob(stmt, i, ptr, arg.byteLength, sqlite3.free_ptr());
			}
			else {
				throw new Error('Unknown parameter type.');
			}
		}
	}
}

class Row {
	#column_names = [];
	constructor(stmt) {
		const data_count = sqlite3.sqlite3_data_count(stmt);

		for (let i = 0; i < data_count; ++i) {
			const type = sqlite3.sqlite3_column_type(stmt, i);
			let val;
			if (type == SQLITE_INTEGER) {
				const int = sqlite3.sqlite3_column_int64(stmt, i);
				val = is_safe(int) ? Number(int) : int;
			}
			else if (type == SQLITE_FLOAT) {
				val = sqlite3.sqlite3_column_double(stmt, i);
			}
			else if (type == SQLITE3_TEXT) {
				const len = sqlite3.sqlite3_column_bytes(stmt, i);
				val = read_str(sqlite3.sqlite3_column_text(stmt, i), len);
			}
			else if (type == SQLITE_BLOB) {
				const len = sqlite3.sqlite3_column_bytes(stmt, i);
				val = mem8(sqlite3.sqlite3_column_blob(stmt, i), len).slice();
			}
			else if (type == SQLITE_NULL) {
				val = null;
			}
			const column_name = read_str(sqlite3.sqlite3_column_name(stmt, i));
			this.#column_names[i] = column_name;
			this[column_name] = val;
		}
	}
	get column_names() {
		return this.#column_names;
	}
	*[Symbol.iterator]() {
		for (const key of this.#column_names) {
			yield this[key];
		}
	}
}

export class Conn {
	ptr = 0;
	// Lifecycle
	async open(params = new OpenParams()) {
		await sqlite_initialized;

		let pathname_ptr, conn_ptr;
		let conn = 0;
		let vfs_ptr = 0;
		try {
			pathname_ptr = alloc_str(params.pathname);
			conn_ptr = sqlite3.malloc(4);
			if (params.vfs) {
				vfs_ptr = alloc_str(params.vfs);
				if (!vfs_ptr) throw new OutOfMemError();
			}
			if (!pathname_ptr || !conn_ptr) throw new OutOfMemError();

			let res = await sqlite3.sqlite3_open_v2(pathname_ptr, conn_ptr, params.flags, vfs_ptr);
			conn = memdv().getInt32(conn_ptr, true);
			handle_error(res, conn);
		} catch(e) {
			sqlite3.sqlite3_close_v2(conn);
			throw e;
		} finally {
			sqlite3.free(pathname_ptr);
			sqlite3.free(conn_ptr);
			sqlite3.free(vfs_ptr);
		}

		if (this.ptr) {
			this.close();
		}
		this.ptr = conn;
	}
	async *backup(dest, { src_db = 'main', dest_db = 'main', pages_per = 5 } = {}) {
		let dconn;
		if (dest instanceof OpenParams) {
			dconn = new Conn();
			await dconn.open(dest);
		} else if (dest instanceof Conn) {
			dconn = dest;
		} else { throw new Error(); }

		const src_name = (src_db == 'main') ? main_ptr : alloc_str(src_db);
		const dest_name = (dest_db == 'main') ? main_ptr : alloc_str(dest_db);
		let backup;
		try {
			if (!src_name || !dest_name) throw new OutOfMemError();
			backup = await sqlite3.sqlite3_backup_init(dconn.ptr, dest_name, this.ptr, src_name); // Does this need to be awaited?
			if (!backup) throw new Error('Backup failed');

			while (1) {
				const res = await sqlite3.sqlite3_backup_step(backup, pages_per);
				handle_error(res, this.ptr);

				if (res == SQLITE_DONE) break;

				const remaining = sqlite3.sqlite3_backup_remaining(backup);
				const count = sqlite3.sqlite3_backup_pagecount(backup);
				yield { remaining, count };
			}
		} finally {
			sqlite3.sqlite3_backup_finish(backup);
			if (src_name != main_ptr) sqlite3.free(src_name);
			if (dest_name != main_ptr) sqlite3.free(dest_name);
			if (dconn != dest) dconn.close();
		}
	}
	close() {
		const old = this.ptr;
		this.ptr = 0;
		sqlite3.sqlite3_close_v2(old);
	}
	// Meta
	filename(db_name = 'main') {
		if (!this.ptr) return;
		const name_ptr = (db_name == 'main') ? main_ptr : alloc_str(db_name);
		try {
			const filename_ptr = sqlite3.sqlite3_db_filename(this.ptr, main_ptr);
			return read_str(filename_ptr) || ':memory:';
		} finally {
			if (name_ptr != main_ptr) sqlite3.free(name_ptr);
		}
	}
	vfs(db_name = 'main') {
		if (!this.ptr) return;

		const name_ptr = (db_name == 'main') ? main_ptr : alloc_str(db_name);
		const vfs_ptr_ptr = sqlite3.malloc(4);
		try {
			if (!vfs_ptr_ptr || !name_ptr) throw new OutOfMemError();
			const res = sqlite3.sqlite3_file_control(this.ptr, name_ptr, SQLITE_FCNTL_VFS_POINTER, vfs_ptr_ptr);
			handle_error(res);
			const vfs_ptr = memdv().getInt32(vfs_ptr_ptr, true);
			const vfs = vfs_impls.get(vfs_ptr)?.vfs;
			return vfs;
		} finally {
			if (name_ptr != main_ptr) sqlite3.free(name_ptr);
			sqlite3.free(vfs_ptr_ptr);
		}
	}
	file(db_name = 'main') {
		if (!this.ptr) return;

		const name_ptr = (db_name == 'main') ? main_ptr : alloc_str(db_name);
		const file_ptr_ptr = sqlite3.malloc(4);
		try {
			if (!file_ptr_ptr || !name_ptr) throw new OutOfMemError();
			const res = sqlite3.sqlite3_file_control(this.ptr, name_ptr, SQLITE_FCNTL_FILE_POINTER, file_ptr_ptr);
			handle_error(res);
			const file_ptr = memdv().getInt32(file_ptr_ptr, true);
			const file = file_impls.get(file_ptr)?.file;
			return file;
		} finally {
			if (name_ptr != main_ptr) sqlite3.free(name_ptr);
			sqlite3.free(file_ptr_ptr);
		}
	}
	get interrupted() {
		if (!this.ptr) return false;
		return Boolean(sqlite3.sqlite3_is_interrupted(this.ptr));
	}
	interrupt() {
		if (this.ptr) {
			sqlite3.sqlite3_interrupt(this.ptr);
		}
	}
	// Useful things:
	async *stmts(sql) {
		if (!sql) return; // Fast path empty sql (useful if you send a single command using Conn.sql)
		
		await sqlite_initialized;

		const sql_ptr = alloc_str(sql);
		const sql_len = sqlite3.strlen(sql_ptr);
		const sql_end_ptr = sqlite3.malloc(4);
		const stmt_ptr = sqlite3.malloc(4);
		try {
			if (!sql_ptr || !sql_end_ptr || !stmt_ptr) throw new OutOfMemError();
			memdv().setInt32(sql_end_ptr, sql_ptr, true);
			const sql_end = sql_ptr + sql_len;
	
			while (1) {
				const sql_ptr = memdv().getInt32(sql_end_ptr, true);
				const remainder = sql_end - sql_ptr;
				if (remainder <= 1) break;
	
				let stmt;
				try {
					// If we don't have any connection open, then connect.
					if (!this.ptr) await this.open();

					const res = await sqlite3.sqlite3_prepare_v2(this.ptr, sql_ptr, remainder, stmt_ptr, sql_end_ptr);
					stmt = memdv().getInt32(stmt_ptr, true);
					handle_error(res, this.ptr);
	
					if (stmt) yield stmt;
				} finally {
					sqlite3.sqlite3_finalize(stmt);
				}
			}
		} finally {
			sqlite3.free(sql_ptr);
			sqlite3.free(sql_end_ptr);
			sqlite3.free(stmt_ptr);
		}
	}
	async *sql(strings, ...args) {
		const bindings = new Bindings();
		const concat = bindings.strings_from_args(strings, args);

		let command = bindings.command();
		if (command instanceof SqlCommand) {
			await command[SqlCommand](this);
		}
		for await (const stmt of this.stmts(concat)) {
			bindings.bind(stmt);
			while (1) {
				const res = await sqlite3.sqlite3_step(stmt);
				handle_error(res, this.ptr);

				if (res == SQLITE_DONE) break;
				if (res != SQLITE_ROW) throw new Error("wat?");

				yield new Row(stmt);
			}

			let command = bindings.command();
			if (command instanceof SqlCommand) {
				await command[SqlCommand](this);
			}
		}
	}
}

export async function exec(sql) {
	let last_row;
	for await (const row of sql) { last_row = row; }
	return last_row;
}

export async function rows(sql) {
	const ret = [];
	for await(const row of sql) {
		ret.push(row);
	}
	return ret;
}

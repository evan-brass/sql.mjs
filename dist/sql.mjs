import { SQLITE_CANTOPEN, SQLITE_DONE, SQLITE_OK, SQLITE_IOERR, SQLITE_OPEN_CREATE, SQLITE_OPEN_EXRESCODE, SQLITE_OPEN_READWRITE, SQLITE_ROW } from "./sqlite_def.mjs";
import spawn_in_worker from "./vm.mjs";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const vfs_impls = new Map();
const last_errors = new Map();
const file_impls = new Map();
const file_vfs = new Map();
export class Vfs {
	name = "mem";
	max_pathname = 64;
	async open(filename, flags) { throw new Error("Default VFS only supports in-memory connections."); }
	async delete(filename, sync) { throw new Error("Default VFS only supports in-memory connections."); }
	async access(filename, flags) { throw new Error("Default VFS only supports in-memory connections."); }
	full_pathname(filename) { return filename; }
	randomness(buff) { crypto.getRandomValues(buff); return buff.byteLength; }
	async sleep(microseconds) { await new Promise(res => setTimeout(res, microseconds / 1000)); }
	current_time() { return BigInt(Date.now()) + 210866760000000n; }
}
export class VfsFile {
	sector_size = 0;
	flags = 0;
	async close() { throw new Error("Missing close implementation"); }
	async read(buff, offset) { throw new Error("Missing read implementation"); }
	async write(buff, offset) { throw new Error("Missing write implementation"); }
	async truncate(size) { throw new Error("Missing truncate implementation"); }
	async sync(flags) {}
	async size() { throw new Error("Missing size implementation"); }
	async lock(lock_level) { throw new Error("Missing lock implementation"); }
	async unlock(lock_level) { throw new Error("Missing unlock implementation"); }
	async check_reserved_lock() { throw new Error("Missing check_reserved_lock implementation"); }
	file_control(op, arg) { return SQLITE_NOTFOUND; }
	device_characteristics() { return 0; }
}
export const sqlite3 = await spawn_in_worker(fetch(new URL('sqlite3.wasm', import.meta.url)), {
	env: {
		async logging(_, code, msg_ptr) {
			const message = cstr_to_js(msg_ptr);
			console.log(`SQLite(${code}): ${message}`);
		},
		async sqlite3_os_init() {
			console.log('sqlite3_os_init');
			await sqlite3.set_logging();
			await register_vfs(new Vfs(), true);
			
			return SQLITE_OK;
		},
		async sqlite3_os_end() {
			console.log('sqlite3_os_end');
			return SQLITE_OK;
		}
	},
	vfs: {
		async xOpen(vfs, filename_ptr, file_out, flags, flags_out) {
			const impl = vfs_impls.get(vfs);
			const filename = await read_str(filename_ptr);
			console.log('xOpen', impl, filename, flags);
			try {
				const file = await impl.open(filename, flags);
				file_impls.set(file_out, file);
				file_vfs.set(file_out, impl);
				
				const io_methods = await sqlite3.get_io_methods();
				await sqlite3.memory.write_i32(flags_out, file.flags);
				await sqlite3.memory.write_i32(file_out, io_methods);
				
				return SQLITE_OK;
			} catch (e) {
				last_errors.set(vfs, `${e.name}: ${e.message}`);
				console.error(e);
				return SQLITE_IOERR;
			}
		},
		async xDelete(vfs, filename_ptr, sync) {
			const impl = vfs_impls.get(vfs);
			const filename = cstr_to_js(filename_ptr);
			console.log('xDelete', impl, filename, sync);
			try {
				await impl.delete(filename, sync);
		
				return SQLITE_OK;
			} catch (e) {
				last_errors.set(vfs, `${e.name}: ${e.message}`);
				console.error(e);
				return SQLITE_IOERR;
			}
		},
		async xAccess(vfs, filename_ptr, flags, result_ptr) {
			const impl = vfs_impls.get(vfs);
			const filename = cstr_to_js(filename_ptr);
			console.log('xAccess', impl, filename, flags);
			try {
				const res = await impl.access(filename, flags);
				memdv().setInt32(result_ptr, res ? 1 : 0, true);
		
				return SQLITE_OK;
			} catch (e) {
				last_errors.set(vfs, `${e.name}: ${e.message}`);
				console.error(e);
				return SQLITE_IOERR;
			}
		},
		async xFullPathname(vfs, filename_ptr, buff_len, buff_ptr) {
			const impl = vfs_impls.get(vfs);
			const filename = await read_str(filename_ptr);
			console.log('xFullPathname', impl, filename, buff_ptr, buff_len);
			let full = await impl.full_pathname(filename);
			if (!full.endsWith('\0')) full += '\0';
			const encoded = encoder.encode(full);
			if (encoded.byteLength > buff_len) return SQLITE_CANTOPEN;
			await sqlite3.memory.write(buff_ptr, encoded);
			return SQLITE_OK;
		},
		xRandomness(vfs, buff_len, buff_ptr) {
			const impl = vfs_impls.get(vfs);
			const buffer = mem8(buff_ptr, buff_len);
			console.log('xRandomness', impl);
			return impl.randomness(buffer);
		},
		async xSleep(vfs, microseconds) {
			const impl = vfs_impls.get(vfs);
			// console.log('xSleep', impl, microseconds);
			const ret = await impl.sleep(microseconds);
			return ret;
		},
		async xGetLastError(vfs, buff_len, buff_ptr) {
			console.log('xGetLastError', buff_len);
			let msg = last_errors.get(vfs) ?? "<No Error>";
			if (!msg.endsWith('\0')) msg += '\0';
			let encoded = encoder.encode();
			if (encoded.byteLength > buff_len) encoded = new Uint8Array(encoded.buffer, encoded.byteOffset, buff_len);
			await sqlite3.memory.write(buff_ptr, encoded);
			return SQLITE_OK;
		},
		xCurrentTimeInt64(vfs, out_ptr) {
			const impl = vfs_impls.get(vfs);
			console.log('xCurrentTimeInt64', impl);
			const res = impl.current_time();
			memdv().setBigInt64(out_ptr, res, true);
		},
		async xClose(file) {
			const impl = file_impls.get(file);
			console.log('xClose', impl);
			try {
				await impl.close();
				return SQLITE_OK;
			} catch (e) {
				const vfs = file_vfs.get(file);
				last_errors.set(vfs, `${e.name}: ${e.message}`);
				console.error(e);
				return SQLITE_IOERR;
			}
		},
		async xRead(file, buff_ptr, buff_len, offset) {
			const impl = file_impls.get(file);
			console.log('xRead', impl, offset, buff_len);
			try {
				const read_buffer = await impl.read(offset, buff_len);
				const buffer = mem8(buff_ptr, buff_len);
				buffer.set(read_buffer);
				if (read_buffer.byteLength < buff_len) {
					// Zero out the buffer.
					buffer.fill(0, read_buffer.byteLength);
					return SQLITE_IOERR_SHORT_READ;
				}
				return SQLITE_OK;
			} catch (e) {
				const vfs = file_vfs.get(file);
				last_errors.set(vfs, `${e.name}: ${e.message}`);
				console.error(e);
				return SQLITE_IOERR;
			}
		},
		async xWrite(file, buff_ptr, buff_len, offset) {
			const impl = file_impls.get(file);
			const buffer = mem8(buff_ptr, buff_len);
			console.log('xWrite', impl, offset, buff_len);
			try {
				await impl.write(buffer, offset);
				return SQLITE_OK;
			} catch (e) {
				const vfs = file_vfs.get(file);
				last_errors.set(vfs, `${e.name}: ${e.message}`);
				console.error(e);
				return SQLITE_IOERR;
			}
		},
		async xTruncate(file, size) {
			const impl = file_impls.get(file);
			console.log('xTruncate', impl);
			try {
				const res = co_await(impl.truncate.bind(impl), size);
				if (res != suspended) { return SQLITE_OK; }
			} catch (e) {
				const vfs = file_vfs.get(file);
				last_errors.set(vfs, `${e.name}: ${e.message}`);
				console.error(e);
				return SQLITE_IOERR;
			}
		},
		async xSync(file, flags) {
			const impl = file_impls.get(file);
			console.log('xSync', impl, flags);
			try {
				await impl.sync(flags);
				return SQLITE_OK;
			} catch (e) {
				const vfs = file_vfs.get(file);
				last_errors.set(vfs, `${e.name}: ${e.message}`);
				console.error(e);
				return SQLITE_IOERR;
			}
		},
		async xFileSize(file, size_ptr) {
			const impl = file_impls.get(file);
			console.log('xFileSize', impl);
			try {
				const size = await impl.size();
				memdv().setBigInt64(size_ptr, BigInt(size), true);
				return SQLITE_OK;
			} catch (e) {
				const vfs = file_vfs.get(file);
				last_errors.set(vfs, `${e.name}: ${e.message}`);
				console.error(e);
				return SQLITE_IOERR;
			}
		},
		async xLock(file, lock_level) {
			const impl = file_impls.get(file);
			console.log('xLock', impl, lock_level);
			try {
				const res = await impl.lock(lock_level);
				if (res === false) { return SQLITE_BUSY; }
				return SQLITE_OK;
			} catch (e) {
				const vfs = file_vfs.get(file);
				last_errors.set(vfs, `${e.name}: ${e.message}`);
				console.error(e);
				return SQLITE_IOERR;
			}
		},
		async xUnlock(file, lock_level) {
			const impl = file_impls.get(file);
			console.log('xUnlock', impl, lock_level);
			try {
				await impl.unlock(lock_level);
				return SQLITE_OK;
			} catch (e) {
				const vfs = memdv().getUint32(file + 4, true);
				last_errors.set(vfs, `${e.name}: ${e.message}`);
				console.error(e);
				return SQLITE_IOERR;
			}
		},
		async xCheckReservedLock(file, res_ptr) {
			const impl = file_impls.get(file);
			console.log('xCheckReservedLock', impl);
			try {
				const res = await impl.check_reserved_lock(); 
				memdv().setInt32(res_ptr, res ? 1 : 0);
				return SQLITE_OK;
			} catch (e) {
				const vfs = file_vfs.get(file);
				last_errors.set(vfs, `${e.name}: ${e.message}`);
				return SQLITE_IOERR;
			}
		},
		async xFileControl(file, op, arg) {
			const impl = file_impls.get(file);
			console.log('xFileControl', impl, op, arg);
			try {
				const res = await impl.file_control(op, arg);
				return res;
			} catch (e) {
				const vfs = file_vfs.get(file);
				last_errors.set(vfs, `${e.name}: ${e.message}`);
				console.error(e);
				return SQLITE_IOERR;
			}
		},
		xSectorSize(file) {
			const impl = file_impls.get(file);
			console.log('xSectorSize', impl);
			return impl.sector_size;
		},
		xDeviceCharacteristics(file) {
			const impl = file_impls.get(file);
			console.log('xDeviceCharacteristics', impl);
			return impl.device_characteristics();
		}
	}
});

async function alloc_str(s) {
	if (!s.endsWith('\0')) {
		s += '\0';
	}
	const encoded = encoder.encode(s);
	const ptr = await sqlite3.malloc(encoded.byteLength);
	if (!ptr) return;
	await sqlite3.memory.write(ptr, encoded);
	return ptr;
}
async function read_str(ptr) {
	const len = await sqlite3.memory.cstr_len(ptr);
	let ret = '';
	if (len > 0) {
		const buff = await sqlite3.memory.read(ptr, len);
		ret = decoder.decode(buff);
	}
	return ret;
}

async function handle_error(code, conn) {
	if (code == SQLITE_OK || code == SQLITE_ROW || code == SQLITE_DONE) return;
	let ptr;
	if (conn) {
		ptr = await sqlite3.sqlite3_errmsg(conn);
	} else {
		ptr = await sqlite3.sqlite3_errstr(code);
	}
	const msg = await read_str(ptr);
	throw new Error(`SQLite Error(${code}): ${msg}`);
}
export async function register_vfs(vfs_impl, make_default = false) {
	const name_ptr = await alloc_str(vfs_impl.name);
	const vfs_ptr = await sqlite3.allocate_vfs(name_ptr, vfs_impl.max_pathname);
	if (!vfs_ptr) throw new Error("Failed to allocate the VFS");
	vfs_impls.set(vfs_ptr, vfs_impl);

	const res = await sqlite3.sqlite3_vfs_register(vfs_ptr, make_default ? 1 : 0);

	await handle_error(res);
}

export default async function connect(pathname, flags = SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_EXRESCODE) {
	let pathname_ptr, conn_ptr;
	try {
		pathname_ptr = await alloc_str(pathname);
		conn_ptr = await sqlite3.malloc(4);
		if (!pathname_ptr || !conn_ptr) return;
		const res = await sqlite3.sqlite3_open_v2(pathname_ptr, conn_ptr, flags, 0);
		const conn = await sqlite3.memory.read_i32(conn_ptr);
		handle_error(res);
	
		return conn;
	} catch(e) {
		await sqlite3.sqlite3_close_v2(conn);
		throw e;
	} finally {
		await sqlite3.free(pathname_ptr);
		await sqlite3.free(conn_ptr);
	}
}

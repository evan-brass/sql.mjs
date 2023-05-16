import {
	SQLITE_ACCESS_EXISTS,
	SQLITE_OPEN_CREATE
} from '../sqlite_def.mjs';
import { File } from './file.mjs';

export class Picker {
	name = 'picker';
	max_pathname = 64;
	async open(filename, flags) {
		const save = filename.get_parameter('save', false);
		const suggestedName = String(filename).replace(/^.*\//, '');
		const result = await self[`show${save ? 'Save' : 'Open'}FilePicker`]({
			multiple: false,
			suggestedName,
			types: [{
				description: "SQLite Database File",
				accept: { 'application/sqlite*': ['.sqlite', '.sqlite3', '.db', '.db3']}
			}]
		});
		const handle = save ? result : result[0];
		return new File(handle, flags);
	}
	async delete(_filename, _sync) {
		throw new Error("Not implemented.");
	}
	async access(_filename, _flags) {
		return false;
	}
	full_pathname(pathname) { return pathname; }
}
export default new Picker();
import fs from 'fs';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const Archs = ['ia32', 'x64'];
const Runtimes = ['nw.js', 'electron', 'node'];
const OSs = ['macos-latest', 'ubuntu-22.04', 'windows-2022'];

export function makeMatrix() {
	const matrix: { runtime: string, arch: string, os: string }[] = [];

	OSs.forEach((os) => {
		Runtimes.forEach((runtime) => {
			Archs.forEach((arch) => {
				if (!((os === 'macos-latest') && arch === 'ia32')) {
					matrix.push({
						runtime,
						arch,
						os,
					});
				}
			});
		});
	});

	return matrix;
}

const run = async (/* release: Release */): Promise<void> => {
	const json: any = {};
	const matrix: any[] = makeMatrix();

	json.include = matrix;

	console.log(json);
	console.log(matrix.length);
	fs.writeFileSync(path.join(__dirname, '..', 'matrix.json'), JSON.stringify(json), 'utf8');
}

(async () => {
	await run();
})();

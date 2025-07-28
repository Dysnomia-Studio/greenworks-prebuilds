import * as dotenv from 'dotenv';
import { execa } from 'execa';
import fs from 'fs-extra';
import mri from 'mri';
import path, { dirname } from 'path';
import { fileURLToPath } from 'url';
import { getVersions } from './utils.js';

const __dirname = dirname(fileURLToPath(import.meta.url))

import 'source-map-support/register.js';
dotenv.config()

// https://www.npmjs.com/package/slash
function slash(slashPath: string) {
	const isExtendedLengthPath = /^\\\\\?\\/.test(slashPath);
	const hasNonAscii = /[^\u0000-\u0080]+/.test(slashPath);

	if (isExtendedLengthPath || hasNonAscii) {
		return slashPath;
	}

	return slashPath.replace(/\\/g, '/');
}

interface Args {
	os: 'macos-latest' | 'ubuntu-latest' | 'windows-2022';
	runtime: 'nw.js' | 'electron' | 'node';
	arch: 'ia32' | 'x64';
	python: string;
}

const GREENWORKS_ROOT = path.join(__dirname, '..', 'greenworks');
const ARTIFACTS_ROOT = path.join(__dirname, '..', 'artifacts');

const argv = process.argv.slice(2);
const args = mri(argv);

const association: Record<Args['os'], string> = {
	'ubuntu-latest': 'linux',
	'windows-2022': 'win32',
	'macos-latest': 'darwin',
};

const {
	os, runtime, arch, python,
}: Args = args as unknown as Args;

console.log('python', python);

const pythonPath = python ? slash(python) : undefined;

console.log('pythonPath', pythonPath);

function getBinaryName(_arch: 'ia32' | 'x64'): string {
	let name = 'greenworks-'

	switch (os) {
		case 'windows-2022':
			name += 'win'
			break
		case 'macos-latest':
			name += 'osx'
			break
		case 'ubuntu-latest':
			name += 'linux'
			break
		default:
			break
	}

	// osx doesn't have arch in the name
	if (os !== 'macos-latest') {
		name += _arch === 'ia32' ? '32' : '64';
	}
	name += '.node';

	return path.resolve(path.join(GREENWORKS_ROOT, 'build', 'Release', name));
}

const electronRebuild = async (version: string): Promise<void> => {
	await execa(
		path.resolve(
			path.join(__dirname, '..', 'node_modules', '.bin', `node-gyp${os === 'windows-2022' ? '.cmd' : ''}`),
		),
		[
			'rebuild',
			'--release',
			`--target=${version}`,
			`--arch=${arch}`,
			'--dist-url=https://electronjs.org/headers',
			// `--python="${pythonPath}"`,
		],
		{
			cwd: GREENWORKS_ROOT,
		},
	);
}

const nodeRebuild = async (version: string): Promise<void> => {
	await execa(
		path.resolve(
			path.join(__dirname, '..', 'node_modules', '.bin', `node-gyp${os === 'windows-2022' ? '.cmd' : ''}`),
		),
		[
			'rebuild',
			'--release',
			`--target=${version}`,
			`--arch=${arch}`,
			// `--python="${pythonPath}"`,
			// '--build_v8_with_gn=false'
		],
		{
			cwd: GREENWORKS_ROOT,
		},
	);
}

const nwjsRebuild = async (version: string): Promise<void> => {
	const nwgypArgs = [
		'rebuild',
		'--release',
		`--target=${version}`,
		`--arch=${arch}`,
		// '--verbose',
	]
	if (os.includes('windows')) {
		// nwgypArgs.push('--make=g++')
	}

	// `--python="${pythonPath}"`,
	await execa(
		path.resolve(path.join(__dirname, '..', 'node_modules', '.bin', `nw-gyp${os === 'windows-2022' ? '.cmd' : ''}`)),
		nwgypArgs,
		{
			cwd: GREENWORKS_ROOT,
		},
	);
}



const build = async (matrix: any): Promise<void> => {
	// @ts-expect-error
	const assetLabel = `greenworks-${matrix.runtime}-v${matrix.abi}-${association[matrix.os]}-${matrix.arch}.node`;

	switch (runtime) {
		case 'electron':
			await electronRebuild(matrix.version);
			break;

		case 'nw.js':
			await nwjsRebuild(matrix.version);
			break;

		case 'node':
			await nodeRebuild(matrix.version);
			break;

		default:
			console.log('Unsupported runtime, use one of electron, node-webkit, node');
			return;
	}

	const filePath = getBinaryName(matrix.arch);

	console.log('filePath', filePath);

	if (!fs.existsSync(filePath)) {
		console.log(`File ${filePath} not found!`);
		return;
	}

	const dest = path.join(ARTIFACTS_ROOT, assetLabel);

	console.log('dest', dest);

	await fs.copy(filePath, dest);
}

void (async (): Promise<void> => {
	await fs.remove(path.resolve(path.join(GREENWORKS_ROOT, 'bin')));
	await fs.remove(path.resolve(path.join(GREENWORKS_ROOT, 'build')));
	await fs.ensureDir(ARTIFACTS_ROOT);

	const versions = await getVersions(runtime, arch, os);

	for (let index = 0; index < versions.length; index += 1) {
		const version = versions[index];

		console.log('version', version);

		const msg = `v${version.version}@${version.abi} - ${version.runtime} - ${version.arch}`;

		console.log(`::group::${msg}`);
		try {
			await build(version);
			console.log('Done');
		} catch (e) {
			console.log('Error during build', e);
		}
		console.log('::endgroup::');
	}
})();

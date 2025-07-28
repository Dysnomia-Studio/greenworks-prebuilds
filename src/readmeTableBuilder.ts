import fs from 'fs';
import { makeMatrix } from "./makeMatrix.js";
import { getVersions } from "./utils.js";

const matrix: { runtime: string, arch: string, os: string }[] = makeMatrix();
let table = '';
for (const { runtime, arch, os } of matrix) {
	if (!arch.includes('64') || !os.includes('windows')) {
		continue;
	}

	const versions = await getVersions(runtime, arch, os);
	
	for (const version of versions) {
		table += `| ${version.runtime} | ${version.version} | ${version.abi} |\n`;
	}
}

fs.writeFileSync('output.md', table);

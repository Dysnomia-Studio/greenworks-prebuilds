import dns from 'dns';
import fs from 'fs-extra';
import { getAll } from 'modules-abi';

export const getUnique = (versions: MbaVersion[], key: keyof MbaVersion): MbaVersion[] => versions
	.map((e) => e[key])
	.map((e, i, final) => final.indexOf(e) === i && i)
	// @ts-expect-error
	.filter((e) => versions[e])
	// @ts-expect-error
	.map((e) => versions[e]);

export const checkInternet = () => {
	return new Promise((resolve, _reject) => {
		dns.lookup('google.com', function (err) {
			if (err && (err.code === "ENOTFOUND" || err.code === "EAI_AGAIN")) {
				return resolve(false);
			} else {
				return resolve(true);
			}
		});
	});
};

const versionFile = './versions.json';
export const getVersions = async (runtime: string, arch: string, os: string): Promise<any> => {
	/* --- cache --- */
	const isOnline = await checkInternet();

	let everything: Record<string, any> = {};
	if (isOnline) {
		console.log("is online");
		everything = await getAll();
		await fs.writeFile(versionFile, JSON.stringify(everything));
	} else {
		console.log("is offline");
		const fileExist = await fs.pathExists(versionFile);

		if (fileExist) {
			const file = await fs.readFile(versionFile, 'utf8');
			everything = JSON.parse(file);
		} else {
			throw new Error('Unable to find offline versions');
		}
	}
	/* --- cache --- */

	if (runtime === 'electron') {
		everything = getUnique(
			everything.filter((entry: any) => entry.runtime === 'electron'),
			'abi',
		);
	}

	if (runtime === 'nw.js') {
		everything = getUnique(
			everything.filter((entry: any) => entry && entry.runtime === 'nw.js'),
			'abi',
		);
	}
	if (runtime === 'node') {
		everything = getUnique(
			everything.filter((entry: any) => entry.runtime === 'node'),
			'abi',
		);
	}

	const matrix: any[] = []
	for (let i = 0; i < everything.length; i += 1) {
		const version = everything[i]

		if (version.abi < 108) {
			continue;
		}

		if (runtime === 'electron' && (os === 'macos-latest') && arch === 'ia32') {
			continue;
		}

		matrix.push({
			runtime,
			abi: version.abi,
			version: version.version,
			arch,
			os,
		})
	}

	return matrix;
}
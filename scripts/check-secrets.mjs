import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
	.split("\0")
	.filter(Boolean)
	.filter((file) => !file.endsWith("package-lock.json"));

const patterns = [
	/-----BEGIN [A-Z ]*PRIVATE KEY-----/,
	/AKIA[0-9A-Z]{16}/,
	/sk_(?:live|test)_[A-Za-z0-9]{16,}/,
	/rk_(?:live|test)_[A-Za-z0-9]{16,}/,
	/xox[baprs]-[A-Za-z0-9-]+/,
];

const findings = [];
for (const file of files) {
	let content;
	try {
		content = readFileSync(file, "utf8");
	} catch {
		continue;
	}
	for (const pattern of patterns) {
		if (pattern.test(content)) {
			findings.push(`${file}: ${pattern}`);
		}
	}
}

if (findings.length > 0) {
	console.error("High-confidence secret pattern(s) detected:");
	for (const finding of findings) console.error(`- ${finding}`);
	process.exitCode = 1;
} else {
	console.log("No high-confidence secret patterns found in tracked files.");
}

import { $ } from 'bun';
import pkg from '../package.json' with { type: 'json' };

// Produces a Chrome Web Store-ready zip of the built `dist/` directory, with
// manifest.json at the archive ROOT. Prefers the `zip` CLI; falls back to
// python3 (zipfile) when `zip` isn't installed (e.g. minimal CI / Arch boxes).
const out = `uswap-extension-${pkg.version}.zip`;
await $`rm -f ${out}`;

const hasZip = await $`command -v zip`.quiet().then(() => true).catch(() => false);
if (hasZip) {
  await $`zip -r ${out} .`.cwd('dist');
  await $`mv dist/${out} ${out}`;
} else {
  await $`python3 -c ${`
import zipfile, os
out = ${JSON.stringify(out)}
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
    for root, _, files in os.walk("dist"):
        for f in files:
            full = os.path.join(root, f)
            z.write(full, os.path.relpath(full, "dist"))
`}`;
}
console.log(`wrote ${out}`);

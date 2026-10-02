import type { LicenseAssessment } from "@/types/analysis";

const PERMISSIVE = new Set(["MIT", "MIT-0", "APACHE-2.0", "BSD-2-CLAUSE", "BSD-3-CLAUSE", "BSD-3-CLAUSE-CLEAR", "0BSD", "ISC", "UNLICENSE", "CC0-1.0", "ZLIB", "BSL-1.0", "WTFPL", "PSF-2.0", "ARTISTIC-2.0", "POSTGRESQL", "X11", "NCSA", "BLUEOAK-1.0.0"]);
const WEAK_COPYLEFT = new Set(["MPL-2.0", "LGPL-2.1", "LGPL-3.0", "EPL-1.0", "EPL-2.0", "CDDL-1.0", "CC-BY-SA-4.0", "MS-RL", "EUPL-1.2", "LGPL-2.1-ONLY", "LGPL-3.0-ONLY", "LGPL-2.1-OR-LATER", "LGPL-3.0-OR-LATER"]);
const COPYLEFT = new Set(["GPL-2.0", "GPL-3.0", "AGPL-3.0", "GPL-2.0-ONLY", "GPL-3.0-ONLY", "GPL-2.0-OR-LATER", "GPL-3.0-OR-LATER", "AGPL-3.0-ONLY", "AGPL-3.0-OR-LATER", "OSL-3.0"]);

export function assessLicense(license: { spdx: string | null; name: string } | null): LicenseAssessment {
  if (!license) {
    return {
      spdx: null,
      name: null,
      kind: "none",
      forkFriendly: false,
      summary: "No license detected. Without a license, the code is all rights reserved: ask the owners before reusing it.",
    };
  }
  const id = (license.spdx ?? "").toUpperCase();
  if (PERMISSIVE.has(id)) {
    return { spdx: license.spdx, name: license.name, kind: "permissive", forkFriendly: true, summary: `${license.name} is permissive: you can fork, modify and continue the project, keeping the license notice.` };
  }
  if (WEAK_COPYLEFT.has(id)) {
    return { spdx: license.spdx, name: license.name, kind: "weak-copyleft", forkFriendly: true, summary: `${license.name} is weak copyleft: forks are allowed, and changes to licensed files must stay under the same terms.` };
  }
  if (COPYLEFT.has(id)) {
    return { spdx: license.spdx, name: license.name, kind: "copyleft", forkFriendly: true, summary: `${license.name} is copyleft: you can continue the project, but derivative work must be released under the same license.` };
  }
  return {
    spdx: license.spdx,
    name: license.name,
    kind: "other",
    forkFriendly: false,
    summary: `${license.name} is a non-standard or unrecognised license. Read the terms before forking.`,
  };
}

/** 0..1 how welcoming the license is for a continuation of the project. */
export function licenseFriendliness(assessment: LicenseAssessment): number {
  switch (assessment.kind) {
    case "permissive":
      return 1;
    case "weak-copyleft":
      return 0.75;
    case "copyleft":
      return 0.6;
    case "other":
      return 0.25;
    case "none":
      return 0.05;
  }
}

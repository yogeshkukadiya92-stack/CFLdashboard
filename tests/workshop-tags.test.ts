import assert from "node:assert/strict";
import test from "node:test";
import {
  extractWorkshopTags,
  groupWorkshopsByTag,
  isWorkshopTagProvided,
  normalizeWorkshopTag,
  workshopHasTag,
  workshopMatchesSearch
} from "../lib/workshop-tags.ts";

test("validates compulsory workshop tag input", () => {
  assert.equal(isWorkshopTagProvided(""), false);
  assert.equal(isWorkshopTagProvided("   "), false);
  assert.equal(isWorkshopTagProvided(null), false);
  assert.equal(isWorkshopTagProvided(undefined), false);
  assert.equal(isWorkshopTagProvided("LP"), true);
  assert.equal(isWorkshopTagProvided("BJS"), true);
  assert.equal(isWorkshopTagProvided("  LP  "), true);
});

test("normalizes single and multiple workshop tags", () => {
  // Single tag
  const single = normalizeWorkshopTag("LP");
  assert.equal(single.tag, "LP");
  assert.deepEqual(single.tags, ["LP"]);

  // Tag with surrounding whitespace
  const trimmed = normalizeWorkshopTag("  BJS  ");
  assert.equal(trimmed.tag, "BJS");
  assert.deepEqual(trimmed.tags, ["BJS"]);

  // Multiple comma-separated tags with irregular spacing and duplicates
  const multiple = normalizeWorkshopTag(" LP , BJS , LP , Health ");
  assert.equal(multiple.tag, "LP, BJS, Health");
  assert.deepEqual(multiple.tags, ["LP", "BJS", "Health"]);

  // Empty string
  const empty = normalizeWorkshopTag("");
  assert.equal(empty.tag, "");
  assert.deepEqual(empty.tags, []);
});

test("searches workshop by tag: example LP and BJS", () => {
  const workshopLP = {
    name: "Life Transformation Bootcamp",
    facilitator: "Dr Luv Patel",
    productGroup: "Leadership",
    type: "Workshop",
    tag: "LP",
    tags: ["LP"]
  };

  const workshopBJS = {
    name: "Business Growth Summit",
    facilitator: "Snehal Kamdar",
    productGroup: "Business Growth",
    type: "Offline Event",
    tag: "BJS",
    tags: ["BJS"]
  };

  const workshopMultiTag = {
    name: "Healthy Forever Intensive",
    facilitator: "Dr Luv Patel",
    productGroup: "Health",
    type: "Workshop",
    tag: "LP, HFW",
    tags: ["LP", "HFW"]
  };

  // Searching 'lp' (case-insensitive) matches workshopLP and workshopMultiTag, but NOT workshopBJS
  assert.equal(workshopMatchesSearch(workshopLP, "lp"), true);
  assert.equal(workshopMatchesSearch(workshopMultiTag, "lp"), true);
  assert.equal(workshopMatchesSearch(workshopBJS, "lp"), false);

  // Searching 'LP' (uppercase) matches
  assert.equal(workshopMatchesSearch(workshopLP, "LP"), true);
  assert.equal(workshopMatchesSearch(workshopBJS, "LP"), false);

  // Searching 'bjs' (case-insensitive) matches workshopBJS, but NOT workshopLP
  assert.equal(workshopMatchesSearch(workshopBJS, "bjs"), true);
  assert.equal(workshopMatchesSearch(workshopBJS, "BJS"), true);
  assert.equal(workshopMatchesSearch(workshopLP, "bjs"), false);
  assert.equal(workshopMatchesSearch(workshopMultiTag, "bjs"), false);

  // Searching 'HFW' matches workshopMultiTag
  assert.equal(workshopMatchesSearch(workshopMultiTag, "hfw"), true);

  // Searching workshop name still works as expected
  assert.equal(workshopMatchesSearch(workshopLP, "bootcamp"), true);
  assert.equal(workshopMatchesSearch(workshopBJS, "growth"), true);

  // Empty query returns true for all
  assert.equal(workshopMatchesSearch(workshopLP, ""), true);
  assert.equal(workshopMatchesSearch(workshopBJS, "   "), true);
});

test("extracts and checks specific tag membership for dedicated tag page", () => {
  const workshop1 = { name: "Workshop A", tag: "LP, BJS", tags: ["LP", "BJS"] };
  const workshop2 = { name: "Workshop B", tag: "LP", tags: ["LP"] };
  const workshop3 = { name: "Workshop C", tag: "BJS", tags: ["BJS"] };

  assert.deepEqual(extractWorkshopTags(workshop1), ["LP", "BJS"]);
  assert.deepEqual(extractWorkshopTags(workshop2), ["LP"]);
  assert.deepEqual(extractWorkshopTags(workshop3), ["BJS"]);

  // Check specific tag presence (case-insensitive exact tag match)
  assert.equal(workshopHasTag(workshop1, "LP"), true);
  assert.equal(workshopHasTag(workshop1, "lp"), true);
  assert.equal(workshopHasTag(workshop1, "BJS"), true);
  assert.equal(workshopHasTag(workshop1, "Other"), false);

  // Only workshops with LP
  const lpOnly = [workshop1, workshop2, workshop3].filter((w) => workshopHasTag(w, "LP"));
  assert.equal(lpOnly.length, 2);
  assert.equal(lpOnly.some((w) => w.name === "Workshop C"), false);

  // Only workshops with BJS
  const bjsOnly = [workshop1, workshop2, workshop3].filter((w) => workshopHasTag(w, "BJS"));
  assert.equal(bjsOnly.length, 2);
  assert.equal(bjsOnly.some((w) => w.name === "Workshop B"), false);
});

test("groups workshops by tag for main dashboard display", () => {
  const workshops = [
    { name: "Workshop 1", tag: "LP", tags: ["LP"], isPaid: true },
    { name: "Workshop 2", tag: "LP", tags: ["LP"], isPaid: false },
    { name: "Workshop 3", tag: "BJS", tags: ["BJS"], isPaid: true },
    { name: "Workshop 4", tag: "LP, BJS", tags: ["LP", "BJS"], isPaid: true },
    { name: "Archived Workshop", tag: "LP", tags: ["LP"], archived: true }
  ];

  const groups = groupWorkshopsByTag(workshops);
  // Group count: 2 distinct tags (LP and BJS)
  assert.equal(groups.length, 2);

  const lpGroup = groups.find((g) => g.tag.toLowerCase() === "lp");
  assert.ok(lpGroup);
  // LP has 3 active workshops (Workshop 1, 2, 4) - archived is excluded
  assert.equal(lpGroup.count, 3);
  assert.equal(lpGroup.paidCount, 2);
  assert.equal(lpGroup.freeCount, 1);

  const bjsGroup = groups.find((g) => g.tag.toLowerCase() === "bjs");
  assert.ok(bjsGroup);
  // BJS has 2 active workshops (Workshop 3, 4)
  assert.equal(bjsGroup.count, 2);
  assert.equal(bjsGroup.paidCount, 2);
  assert.equal(bjsGroup.freeCount, 0);
});

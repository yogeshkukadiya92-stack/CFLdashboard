import assert from "node:assert/strict";
import test from "node:test";
import { consumeWorkshopPanelUrl } from "../lib/workshop-panel-url.ts";

test("consumes workshop panel deep links while preserving filters and anchors", () => {
  for (const key of ["edit", "workshopId", "id"]) {
    assert.equal(consumeWorkshopPanelUrl(`https://dashboard.coachforlife.in/workshop-master?${key}=blueprint&tag=BJS#workshops`), "/workshop-master?tag=BJS#workshops");
  }
  assert.equal(consumeWorkshopPanelUrl("https://dashboard.coachforlife.in/workshop-master?edit=one&workshopId=two&id=three"), "/workshop-master");
});

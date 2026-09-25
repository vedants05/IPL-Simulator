import assert from "node:assert/strict";
import { layoutFactors } from "../components/player/AuctionValueTile";

const widths = [102, 94, 87, 91, 104, 88, 93, 98];
const heights = [36, 37, 34, 35, 38, 36, 34, 37];
const width = 288;
const height = 190;
const centre = { x: width / 2, y: height / 2, halfWidth: 40, halfHeight: 34 };
const boxes = widths.map((boxWidth, index) => ({ x: 0, y: 0, halfWidth: boxWidth / 2, halfHeight: heights[index] / 2 }));
const points = layoutFactors(boxes, centre, width, height, widths.map((_, index) => `Factor ${index}`));

assert.equal(points.filter(Boolean).length, 8, "All eight factor boxes should fit");
points.forEach((point, index) => {
  assert.ok(point);
  assert.ok(point.x - boxes[index].halfWidth >= 2 && point.x + boxes[index].halfWidth <= width - 2);
  assert.ok(point.y - boxes[index].halfHeight >= 2 && point.y + boxes[index].halfHeight <= height - 2);
  const collides = (other: typeof centre) => Math.abs(point.x - other.x) < boxes[index].halfWidth + other.halfWidth
    && Math.abs(point.y - other.y) < boxes[index].halfHeight + other.halfHeight;
  assert.ok(!collides(centre), `Factor ${index} overlaps the price`);
  points.slice(0, index).forEach((other, otherIndex) => {
    assert.ok(other);
    assert.ok(!collides({ ...boxes[otherIndex], ...other }), `Factors ${index} and ${otherIndex} overlap`);
  });
});

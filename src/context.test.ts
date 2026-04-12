import assert from "node:assert/strict";
import test from "node:test";
import { defaultProductRegistry, findProductByRepo } from "./product-context.ts";

test("default product registry contains the five configured products", () => {
  assert.equal(defaultProductRegistry.length, 5);
  assert.equal(defaultProductRegistry.some((product) => product.id === "peppera"), true);
  assert.equal(defaultProductRegistry.some((product) => product.id === "echocart"), true);
  assert.equal(defaultProductRegistry.some((product) => product.id === "settley"), true);
  assert.equal(defaultProductRegistry.some((product) => product.id === "autobett"), true);
  assert.equal(defaultProductRegistry.some((product) => product.id === "temisangerrard"), true);
});

test("repo lookup maps known GitHub repositories to products", () => {
  const peppera = findProductByRepo("temisangerrard/systemeats");
  const settley = findProductByRepo("temisangerrard/settley-marketing");

  assert.equal(peppera?.id, "peppera");
  assert.equal(settley?.id, "settley");
});

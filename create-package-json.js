#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const createPackageJson = (type, dir) => {
  const content = {
    type: type,
  };
  const directory = path.resolve(__dirname, dir);
  if (!fs.existsSync(directory)) {
    fs.mkdirSync(directory, { recursive: true });
  }
  fs.writeFileSync(
    path.join(directory, "package.json"),
    JSON.stringify(content, null, 2)
  );
};

createPackageJson("commonjs", "./dist/cjs");
createPackageJson("module", "./dist/esm");

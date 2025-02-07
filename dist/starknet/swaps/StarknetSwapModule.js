"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetSwapModule = void 0;
const StarknetModule_1 = require("../base/StarknetModule");
class StarknetSwapModule extends StarknetModule_1.StarknetModule {
    constructor(root) {
        super(root);
        this.root = root;
        this.contract = root.contract;
    }
}
exports.StarknetSwapModule = StarknetSwapModule;

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StarknetPersistentSigner = exports.StarknetChainEvents = void 0;
/**
 * Node.js-only entrypoint for filesystem-backed Starknet helpers.
 *
 * Import from `@atomiqlabs/chain-starknet/node` when you need runtime features
 * that depend on Node's `fs` module.
 *
 * @packageDocumentation
 */
var StarknetChainEvents_1 = require("../starknet/events/StarknetChainEvents");
Object.defineProperty(exports, "StarknetChainEvents", { enumerable: true, get: function () { return StarknetChainEvents_1.StarknetChainEvents; } });
var StarknetPersistentSigner_1 = require("../starknet/wallet/StarknetPersistentSigner");
Object.defineProperty(exports, "StarknetPersistentSigner", { enumerable: true, get: function () { return StarknetPersistentSigner_1.StarknetPersistentSigner; } });

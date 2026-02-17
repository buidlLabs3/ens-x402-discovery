// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IENSRegistry} from "../interfaces/IENSRegistry.sol";

contract MockENSRegistry is IENSRegistry {
    mapping(bytes32 => address) private owners;

    function setOwner(bytes32 node, address ownerAddress) external {
        owners[node] = ownerAddress;
    }

    function owner(bytes32 node) external view returns (address) {
        return owners[node];
    }
}

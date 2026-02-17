// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IENSRegistry {
    function owner(bytes32 node) external view returns (address);
}

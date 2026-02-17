// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IENSRegistry} from "./interfaces/IENSRegistry.sol";

contract ServiceRegistry {
    struct ServiceRecord {
        bytes32 ensNode;
        string ensName;
        string endpoint;
        string paymentScheme;
        string network;
        string description;
        string capabilitiesJson;
        address owner;
        bool active;
        uint256 updatedAt;
    }

    error InvalidENSRegistry();
    error NotNodeOwner(bytes32 node, address caller);
    error EmptyEnsName();
    error EmptyEndpoint();
    error ServiceNotFound(bytes32 node);

    event ServiceRegistered(bytes32 indexed ensNode, string ensName, string endpoint, address indexed owner);
    event ServiceDeactivated(bytes32 indexed ensNode, address indexed owner);

    mapping(bytes32 => ServiceRecord) private services;
    bytes32[] private allServiceNodes;
    IENSRegistry public immutable ensRegistry;

    constructor(address ensRegistryAddress) {
        if (ensRegistryAddress == address(0)) {
            revert InvalidENSRegistry();
        }
        ensRegistry = IENSRegistry(ensRegistryAddress);
    }

    function registerService(
        bytes32 ensNode,
        string calldata ensName,
        string calldata endpoint,
        string calldata paymentScheme,
        string calldata network,
        string calldata description,
        string calldata capabilitiesJson
    ) external {
        _requireNodeOwner(ensNode);

        if (bytes(ensName).length == 0) {
            revert EmptyEnsName();
        }
        if (bytes(endpoint).length == 0) {
            revert EmptyEndpoint();
        }

        ServiceRecord storage existing = services[ensNode];
        bool isNew = existing.owner == address(0);
        if (isNew) {
            allServiceNodes.push(ensNode);
        }

        services[ensNode] = ServiceRecord({
            ensNode: ensNode,
            ensName: ensName,
            endpoint: endpoint,
            paymentScheme: paymentScheme,
            network: network,
            description: description,
            capabilitiesJson: capabilitiesJson,
            owner: msg.sender,
            active: true,
            updatedAt: block.timestamp
        });

        emit ServiceRegistered(ensNode, ensName, endpoint, msg.sender);
    }

    function deactivateService(bytes32 ensNode) external {
        ServiceRecord storage service = services[ensNode];
        if (service.owner == address(0)) {
            revert ServiceNotFound(ensNode);
        }
        _requireNodeOwner(ensNode);

        service.active = false;
        service.updatedAt = block.timestamp;

        emit ServiceDeactivated(ensNode, msg.sender);
    }

    function getService(bytes32 ensNode) external view returns (ServiceRecord memory) {
        ServiceRecord memory service = services[ensNode];
        if (service.owner == address(0)) {
            revert ServiceNotFound(ensNode);
        }
        return service;
    }

    function listServices(uint256 offset, uint256 limit)
        external
        view
        returns (ServiceRecord[] memory items, uint256 totalActive)
    {
        if (limit == 0) {
            return (new ServiceRecord[](0), 0);
        }

        uint256 activeCount = 0;
        uint256 totalNodes = allServiceNodes.length;
        for (uint256 i = 0; i < totalNodes; i++) {
            if (services[allServiceNodes[i]].active) {
                activeCount++;
            }
        }

        totalActive = activeCount;
        if (offset >= activeCount) {
            return (new ServiceRecord[](0), activeCount);
        }

        uint256 remaining = activeCount - offset;
        uint256 size = remaining < limit ? remaining : limit;
        items = new ServiceRecord[](size);

        uint256 seen = 0;
        uint256 written = 0;
        for (uint256 i = 0; i < totalNodes && written < size; i++) {
            ServiceRecord memory service = services[allServiceNodes[i]];
            if (!service.active) {
                continue;
            }
            if (seen < offset) {
                seen++;
                continue;
            }
            items[written] = service;
            written++;
        }

        return (items, activeCount);
    }

    function _requireNodeOwner(bytes32 ensNode) private view {
        if (ensRegistry.owner(ensNode) != msg.sender) {
            revert NotNodeOwner(ensNode, msg.sender);
        }
    }
}

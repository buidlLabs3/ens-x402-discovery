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
        uint256 totalRating;
        uint256 ratingCount;
        uint256 updatedAt;
    }

    error InvalidENSRegistry();
    error NotNodeOwner(bytes32 node, address caller);
    error EmptyEnsName();
    error EmptyEndpoint();
    error InvalidRating(uint8 rating);
    error AlreadyRated(bytes32 node, address rater);
    error ServiceInactive(bytes32 node);
    error ServiceAlreadyInactive(bytes32 node);
    error ServiceNotFound(bytes32 node);

    event ServiceRegistered(bytes32 indexed ensNode, string ensName, string endpoint, address indexed owner);
    event ServiceDeactivated(bytes32 indexed ensNode, address indexed owner);
    event ServiceRated(bytes32 indexed ensNode, address indexed rater, uint8 rating, uint256 ratingCount);

    mapping(bytes32 => ServiceRecord) private services;
    mapping(bytes32 => mapping(address => bool)) private ratingsByRater;
    bytes32[] private allServiceNodes;
    uint256 private activeServiceCount;
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
            activeServiceCount += 1;
        } else if (!existing.active) {
            activeServiceCount += 1;
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
            totalRating: existing.totalRating,
            ratingCount: existing.ratingCount,
            updatedAt: block.timestamp
        });

        emit ServiceRegistered(ensNode, ensName, endpoint, msg.sender);
    }

    function deactivateService(bytes32 ensNode) external {
        ServiceRecord storage service = services[ensNode];
        if (service.owner == address(0)) {
            revert ServiceNotFound(ensNode);
        }
        if (!service.active) {
            revert ServiceAlreadyInactive(ensNode);
        }
        _requireNodeOwner(ensNode);

        service.active = false;
        activeServiceCount -= 1;
        service.updatedAt = block.timestamp;

        emit ServiceDeactivated(ensNode, msg.sender);
    }

    function rateService(bytes32 ensNode, uint8 rating) external {
        ServiceRecord storage service = services[ensNode];
        if (service.owner == address(0)) {
            revert ServiceNotFound(ensNode);
        }
        if (!service.active) {
            revert ServiceInactive(ensNode);
        }
        if (rating < 1 || rating > 5) {
            revert InvalidRating(rating);
        }
        if (ratingsByRater[ensNode][msg.sender]) {
            revert AlreadyRated(ensNode, msg.sender);
        }

        ratingsByRater[ensNode][msg.sender] = true;
        service.totalRating += rating;
        service.ratingCount += 1;
        service.updatedAt = block.timestamp;

        emit ServiceRated(ensNode, msg.sender, rating, service.ratingCount);
    }

    function getAverageRatingBps(bytes32 ensNode) external view returns (uint256) {
        ServiceRecord memory service = services[ensNode];
        if (service.owner == address(0)) {
            revert ServiceNotFound(ensNode);
        }
        if (service.ratingCount == 0) {
            return 0;
        }
        return (service.totalRating * 10_000) / (service.ratingCount * 5);
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

        uint256 activeCount = activeServiceCount;
        totalActive = activeCount;
        if (offset >= activeCount) {
            return (new ServiceRecord[](0), activeCount);
        }

        uint256 remaining = activeCount - offset;
        uint256 size = remaining < limit ? remaining : limit;
        items = new ServiceRecord[](size);

        uint256 totalNodes = allServiceNodes.length;
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

    function getActiveServiceCount() external view returns (uint256) {
        return activeServiceCount;
    }

    function _requireNodeOwner(bytes32 ensNode) private view {
        if (ensRegistry.owner(ensNode) != msg.sender) {
            revert NotNodeOwner(ensNode, msg.sender);
        }
    }
}

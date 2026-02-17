// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IENSRegistry {
    function owner(bytes32 node) external view returns (address);
}

contract ENSResolverExtension {
    struct ServiceMetadata {
        string endpoint;
        string paymentScheme;
        string network;
        string description;
        string capabilitiesJson;
        uint256 updatedAt;
    }

    error NotNodeOwner(bytes32 node, address caller);
    error EmptyEndpoint();

    event X402EndpointSet(bytes32 indexed node, string endpoint, address indexed owner);

    IENSRegistry public immutable ensRegistry;
    mapping(bytes32 => ServiceMetadata) private metadataByNode;

    constructor(address ensRegistryAddress) {
        require(ensRegistryAddress != address(0), "registry address required");
        ensRegistry = IENSRegistry(ensRegistryAddress);
    }

    function setX402Endpoint(
        bytes32 node,
        string calldata endpoint,
        string calldata paymentScheme,
        string calldata network,
        string calldata description,
        string calldata capabilitiesJson
    ) external {
        if (ensRegistry.owner(node) != msg.sender) {
            revert NotNodeOwner(node, msg.sender);
        }
        if (bytes(endpoint).length == 0) {
            revert EmptyEndpoint();
        }

        metadataByNode[node] = ServiceMetadata({
            endpoint: endpoint,
            paymentScheme: paymentScheme,
            network: network,
            description: description,
            capabilitiesJson: capabilitiesJson,
            updatedAt: block.timestamp
        });

        emit X402EndpointSet(node, endpoint, msg.sender);
    }

    function getX402Endpoint(bytes32 node) external view returns (ServiceMetadata memory) {
        return metadataByNode[node];
    }
}

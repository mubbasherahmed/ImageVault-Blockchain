// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ImageVault
 * @dev A smart contract for managing image assets as non-fungible digital assets.
 *      Each image is identified by its unique SHA-256 hash and has an owner who
 *      can grant or revoke access to other addresses (keys).
 *
 *      Think of it like Bitcoin/Ethereum but for images:
 *      - Each image hash is like a unique coin/token
 *      - Only the owner's private key can control it
 *      - Access can be granted to other wallets (like sending a viewing key)
 *      - Ownership can be transferred (like sending crypto to another wallet)
 */
contract ImageVault is Ownable, ReentrancyGuard {
    // =========================================================================
    //                              DATA STRUCTURES
    // =========================================================================

    /// @dev Represents an image asset registered on-chain
    struct ImageData {
        bytes32 imageHash;       // SHA-256 hash of the image file
        string name;             // Human-readable name
        string description;      // Description of the image
        address owner;           // Current owner's wallet address
        uint256 registeredAt;    // Block timestamp when registered
        uint256 accessCount;     // Number of addresses with access
        bool exists;             // Whether this image has been registered
    }

    // =========================================================================
    //                              STATE VARIABLES
    // =========================================================================

    /// @dev Maps image hash => image metadata
    mapping(bytes32 => ImageData) private _images;

    /// @dev Maps image hash => (address => has access)
    mapping(bytes32 => mapping(address => bool)) private _accessList;

    /// @dev Maps owner address => array of image hashes they own
    mapping(address => bytes32[]) private _ownedImages;

    /// @dev Maps address => array of image hashes they have access to (but don't own)
    mapping(address => bytes32[]) private _accessibleImages;

    /// @dev Total number of registered images
    uint256 private _totalImages;

    /// @dev Array of all registered image hashes (for enumeration)
    bytes32[] private _allImageHashes;

    // =========================================================================
    //                                 EVENTS
    // =========================================================================

    /// @dev Emitted when a new image is registered
    event ImageRegistered(
        bytes32 indexed imageHash,
        address indexed owner,
        string name,
        uint256 timestamp
    );

    /// @dev Emitted when access is granted to an address
    event AccessGranted(
        bytes32 indexed imageHash,
        address indexed owner,
        address indexed grantee
    );

    /// @dev Emitted when access is revoked from an address
    event AccessRevoked(
        bytes32 indexed imageHash,
        address indexed owner,
        address indexed revokee
    );

    /// @dev Emitted when image ownership is transferred
    event OwnershipTransferred(
        bytes32 indexed imageHash,
        address indexed previousOwner,
        address indexed newOwner
    );

    // =========================================================================
    //                                 ERRORS
    // =========================================================================

    error ImageAlreadyRegistered(bytes32 imageHash);
    error ImageNotFound(bytes32 imageHash);
    error NotImageOwner(bytes32 imageHash, address caller);
    error AlreadyHasAccess(bytes32 imageHash, address user);
    error NoAccess(bytes32 imageHash, address user);
    error InvalidAddress();
    error CannotRevokeOwnerAccess();
    error CannotTransferToSelf();

    // =========================================================================
    //                               MODIFIERS
    // =========================================================================

    /// @dev Ensures the image exists
    modifier imageExists(bytes32 imageHash) {
        if (!_images[imageHash].exists) {
            revert ImageNotFound(imageHash);
        }
        _;
    }

    /// @dev Ensures the caller is the image owner
    modifier onlyImageOwner(bytes32 imageHash) {
        if (_images[imageHash].owner != msg.sender) {
            revert NotImageOwner(imageHash, msg.sender);
        }
        _;
    }

    // =========================================================================
    //                              CONSTRUCTOR
    // =========================================================================

    constructor() Ownable(msg.sender) {}

    // =========================================================================
    //                           CORE FUNCTIONS
    // =========================================================================

    /**
     * @notice Register a new image on the blockchain
     * @param imageHash The SHA-256 hash of the image file
     * @param name Human-readable name for the image
     * @param description Description of the image
     */
    function registerImage(
        bytes32 imageHash,
        string calldata name,
        string calldata description
    ) external nonReentrant {
        if (imageHash == bytes32(0)) revert InvalidAddress();
        if (_images[imageHash].exists) {
            revert ImageAlreadyRegistered(imageHash);
        }

        // Create the image record
        _images[imageHash] = ImageData({
            imageHash: imageHash,
            name: name,
            description: description,
            owner: msg.sender,
            registeredAt: block.timestamp,
            accessCount: 1, // Owner always has access
            exists: true
        });

        // Owner automatically has access
        _accessList[imageHash][msg.sender] = true;

        // Track ownership
        _ownedImages[msg.sender].push(imageHash);
        _allImageHashes.push(imageHash);
        _totalImages++;

        emit ImageRegistered(imageHash, msg.sender, name, block.timestamp);
    }

    /**
     * @notice Grant access to an image for a specific address
     * @param imageHash The hash of the image
     * @param user The address to grant access to
     */
    function grantAccess(bytes32 imageHash, address user)
        external
        imageExists(imageHash)
        onlyImageOwner(imageHash)
    {
        if (user == address(0)) revert InvalidAddress();
        if (_accessList[imageHash][user]) {
            revert AlreadyHasAccess(imageHash, user);
        }

        _accessList[imageHash][user] = true;
        _images[imageHash].accessCount++;
        _accessibleImages[user].push(imageHash);

        emit AccessGranted(imageHash, msg.sender, user);
    }

    /**
     * @notice Revoke access from a specific address
     * @param imageHash The hash of the image
     * @param user The address to revoke access from
     */
    function revokeAccess(bytes32 imageHash, address user)
        external
        imageExists(imageHash)
        onlyImageOwner(imageHash)
    {
        if (user == _images[imageHash].owner) {
            revert CannotRevokeOwnerAccess();
        }
        if (!_accessList[imageHash][user]) {
            revert NoAccess(imageHash, user);
        }

        _accessList[imageHash][user] = false;
        _images[imageHash].accessCount--;

        // Remove from accessible images array
        _removeFromAccessibleImages(user, imageHash);

        emit AccessRevoked(imageHash, msg.sender, user);
    }

    /**
     * @notice Transfer ownership of an image to another address
     * @param imageHash The hash of the image
     * @param newOwner The address of the new owner
     */
    function transferImageOwnership(bytes32 imageHash, address newOwner)
        external
        nonReentrant
        imageExists(imageHash)
        onlyImageOwner(imageHash)
    {
        if (newOwner == address(0)) revert InvalidAddress();
        if (newOwner == msg.sender) revert CannotTransferToSelf();

        address previousOwner = msg.sender;

        // Update ownership
        _images[imageHash].owner = newOwner;

        // Grant access to new owner if they don't have it
        if (!_accessList[imageHash][newOwner]) {
            _accessList[imageHash][newOwner] = true;
            _images[imageHash].accessCount++;
        }

        // Move from old owner's list to new owner's list
        _removeFromOwnedImages(previousOwner, imageHash);
        _ownedImages[newOwner].push(imageHash);

        // Remove from new owner's accessible list (since they now own it)
        _removeFromAccessibleImages(newOwner, imageHash);

        emit OwnershipTransferred(imageHash, previousOwner, newOwner);
    }

    // =========================================================================
    //                            VIEW FUNCTIONS
    // =========================================================================

    /**
     * @notice Check if an address has access to view an image
     * @param imageHash The hash of the image
     * @param user The address to check
     * @return bool True if the user has access
     */
    function hasAccess(bytes32 imageHash, address user)
        external
        view
        imageExists(imageHash)
        returns (bool)
    {
        return _accessList[imageHash][user];
    }

    /**
     * @notice Get the full metadata of an image
     * @param imageHash The hash of the image
     * @return ImageData The image metadata
     */
    function getImageData(bytes32 imageHash)
        external
        view
        imageExists(imageHash)
        returns (ImageData memory)
    {
        return _images[imageHash];
    }

    /**
     * @notice Get the owner of an image
     * @param imageHash The hash of the image
     * @return address The owner's address
     */
    function getImageOwner(bytes32 imageHash)
        external
        view
        imageExists(imageHash)
        returns (address)
    {
        return _images[imageHash].owner;
    }

    /**
     * @notice Get all image hashes owned by an address
     * @param owner The owner's address
     * @return bytes32[] Array of image hashes
     */
    function getOwnedImages(address owner)
        external
        view
        returns (bytes32[] memory)
    {
        return _ownedImages[owner];
    }

    /**
     * @notice Get all image hashes an address has access to (but doesn't own)
     * @param user The user's address
     * @return bytes32[] Array of image hashes
     */
    function getAccessibleImages(address user)
        external
        view
        returns (bytes32[] memory)
    {
        return _accessibleImages[user];
    }

    /**
     * @notice Get the total number of registered images
     * @return uint256 Total image count
     */
    function getTotalImages() external view returns (uint256) {
        return _totalImages;
    }

    /**
     * @notice Get all registered image hashes
     * @return bytes32[] Array of all image hashes
     */
    function getAllImageHashes() external view returns (bytes32[] memory) {
        return _allImageHashes;
    }

    /**
     * @notice Check if an image hash has been registered
     * @param imageHash The hash to check
     * @return bool True if registered
     */
    function isRegistered(bytes32 imageHash) external view returns (bool) {
        return _images[imageHash].exists;
    }

    // =========================================================================
    //                          INTERNAL FUNCTIONS
    // =========================================================================

    /// @dev Remove an image hash from an owner's list
    function _removeFromOwnedImages(address owner, bytes32 imageHash) internal {
        bytes32[] storage hashes = _ownedImages[owner];
        for (uint256 i = 0; i < hashes.length; i++) {
            if (hashes[i] == imageHash) {
                hashes[i] = hashes[hashes.length - 1];
                hashes.pop();
                break;
            }
        }
    }

    /// @dev Remove an image hash from a user's accessible images list
    function _removeFromAccessibleImages(address user, bytes32 imageHash) internal {
        bytes32[] storage hashes = _accessibleImages[user];
        for (uint256 i = 0; i < hashes.length; i++) {
            if (hashes[i] == imageHash) {
                hashes[i] = hashes[hashes.length - 1];
                hashes.pop();
                break;
            }
        }
    }
}

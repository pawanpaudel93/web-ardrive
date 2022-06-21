// SPDX-License-Identifier: MIT

pragma solidity ^0.8.4;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTMarketPlace is ERC721URIStorage, Ownable {
    using Counters for Counters.Counter;
    Counters.Counter private _tokenIds;
    Counters.Counter private _itemsSold;

    uint256 internal listingPrice = 0.025 ether;

    constructor() ERC721("Metaverse Tokens", "METT") {}

    struct MarketItem {
        uint256 tokenId;
        uint256 price;
        address payable seller;
        address payable owner;
        bool sold;
    }

    mapping(uint256 => MarketItem) private idToMarketItem;

    event MarketItemEvent(
        uint256 indexed tokenId,
        uint256 price,
        address seller,
        address owner,
        bool sold
    );

    function getListingPrice() public view returns (uint256) {
        return listingPrice;
    }

    function updateListingPrice(uint256 _listingPrice) public onlyOwner {
        listingPrice = _listingPrice;
    }

    function createToken(string memory _tokenURI, uint256 _price)
        public
        payable
        returns (uint256)
    {
        _tokenIds.increment();
        uint256 newTokenId = _tokenIds.current();
        _mint(msg.sender, newTokenId);
        _setTokenURI(newTokenId, _tokenURI);
        createMarketItem(newTokenId, _price);
        return newTokenId;
    }

    function createMarketItem(uint256 _tokenId, uint256 _price) public payable {
        require(_price > 0, "Price must be atleast 1 wei");
        require(
            msg.value == listingPrice,
            "Price must be equal to listing price"
        );
        require(
            ownerOf(_tokenId) == msg.sender,
            "Only owner can create market item"
        );

        idToMarketItem[_tokenId] = MarketItem(
            _tokenId,
            _price,
            payable(msg.sender),
            payable(address(this)),
            false
        );
        _transfer(msg.sender, address(this), _tokenId);
        emit MarketItemEvent(_tokenId, _price, msg.sender, address(0), false);
    }

    function createMarketSale(uint256 _tokenId) public payable {
        uint256 price = idToMarketItem[_tokenId].price;
        address seller = idToMarketItem[_tokenId].seller;
        require(msg.value == price, "Price must be equal to asking price");
        idToMarketItem[_tokenId].owner = payable(msg.sender);
        idToMarketItem[_tokenId].sold = true;
        idToMarketItem[_tokenId].seller = payable(address(0));
        _itemsSold.increment();
        _transfer(address(this), msg.sender, _tokenId);
        (bool success, ) = owner().call{value: listingPrice}("");
        require(success, "Failed to send listing price to owner");
        (success, ) = seller.call{value: msg.value}("");
        require(success, "Failed to send paymemt to NFT owner");
    }

    function resellToken(uint256 _tokenId, uint256 price) public payable {
        require(
            idToMarketItem[_tokenId].owner == msg.sender,
            "Only owner can resell"
        );
        require(
            msg.value == listingPrice,
            "Price must be equal to listing price"
        );
        idToMarketItem[_tokenId].sold = false;
        idToMarketItem[_tokenId].price = price;
        idToMarketItem[_tokenId].seller = payable(msg.sender);
        idToMarketItem[_tokenId].owner = payable(address(this));
        // _itemsSold.decrement();

        _transfer(msg.sender, address(this), _tokenId);
    }

    function cancelTokenSale(uint256 _tokenId) public {
        require(
            idToMarketItem[_tokenId].seller == msg.sender,
            "Only seller can cancel"
        );
        require(
            idToMarketItem[_tokenId].sold == false,
            "Only unsold items can be cancelled"
        );
        idToMarketItem[_tokenId].owner = payable(msg.sender);
        idToMarketItem[_tokenId].seller = payable(address(0));

        _transfer(address(this), msg.sender, _tokenId);
    }

    function fetchMarketItems() public view returns (MarketItem[] memory) {
        uint256 totalItemCount = _tokenIds.current();
        uint256 itemCount = 0;
        uint256 currentIndex = 0;

        for (uint256 i = 0; i < totalItemCount; i++) {
            if (idToMarketItem[i + 1].owner == address(this)) {
                itemCount++;
            }
        }

        MarketItem[] memory items = new MarketItem[](itemCount);

        for (uint256 i = 0; i < totalItemCount; i++) {
            if (idToMarketItem[i + 1].owner == address(this)) {
                MarketItem storage currentItem = idToMarketItem[i + 1];
                items[currentIndex] = currentItem;
                currentIndex++;
            }
        }
        return items;
    }

    function fetchMyNFTs() public view returns (MarketItem[] memory) {
        uint256 totalItemCount = _tokenIds.current();
        uint256 itemCount = 0;
        uint256 currentIndex = 0;

        for (uint256 i = 0; i < totalItemCount; i++) {
            if (idToMarketItem[i + 1].owner == msg.sender) {
                itemCount++;
            }
        }

        MarketItem[] memory items = new MarketItem[](itemCount);
        for (uint256 i = 0; i < totalItemCount; i++) {
            if (idToMarketItem[i + 1].owner == msg.sender) {
                MarketItem storage currentItem = idToMarketItem[i + 1];
                items[currentIndex] = currentItem;
                currentIndex++;
            }
        }
        return items;
    }

    function fetchItemsListed() public view returns (MarketItem[] memory) {
        uint256 totalItemCount = _tokenIds.current();
        uint256 itemCount = 0;
        uint256 currentIndex = 0;

        for (uint256 i = 0; i < totalItemCount; i++) {
            if (idToMarketItem[i + 1].seller == msg.sender) {
                itemCount++;
            }
        }

        MarketItem[] memory items = new MarketItem[](itemCount);
        for (uint256 i = 0; i < totalItemCount; i++) {
            if (idToMarketItem[i + 1].seller == msg.sender) {
                MarketItem storage currentItem = idToMarketItem[i + 1];
                items[currentIndex] = currentItem;
                currentIndex++;
            }
        }
        return items;
    }
}

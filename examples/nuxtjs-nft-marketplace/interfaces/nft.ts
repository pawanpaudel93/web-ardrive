export type NFT = {
    price: string,
    tokenId: string,
    seller: string,
    owner: string,
    image: string,
    name: string,
    description: string,
    sold?: boolean,
    tokenURI?: string,
}
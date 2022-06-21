<template>
  <div class="px-4 text-center" style="max-width: 1600px">
    <div
      v-if="nfts.length > 0"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4"
    >
      <div
        v-for="(nft, i) in nfts"
        :key="i"
        class="border shadow rounded-xl overflow-hidden"
      >
        <img :src="nft.image" style="height: 200px" />
        <div class="p-4">
          <p style="height: 64px" class="text-2xl font-semibold">
            {{ nft.name }}
          </p>
          <div style="height: 70px; overflow: hidden">
            <p class="text-gray-400">
              {{ nft.description }}
            </p>
          </div>
        </div>

        <div class="p-4 bg-black">
          <p class="text-2xl mb-4 font-bold text-white">
            Price - {{ nft.price }} Matic
          </p>

          <button
            class="w-full bg-blue-500 text-white font-bold py-2 px-12 rounded"
            @click="buyNFTs(nft)"
          >
            Buy
          </button>
        </div>
      </div>
    </div>
    <div v-else>
      <div class="text-center mt-6">
        <p class="text-2xl font-semibold text-black">
          No items in marketplace.
        </p>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {
  defineComponent,
  ref,
  reactive,
  useFetch,
  useContext,
  useRouter,
  onMounted,
} from '@nuxtjs/composition-api'
import { ethers } from 'ethers'
import Web3Modal from 'web3modal'
import Market from '@/contract/artifacts/contracts/NFTMarketPlace.sol/NFTMarketPlace.json'
import { NFT } from '@/interfaces/nft'

export default defineComponent({
  name: 'HomePage',
  layout: 'default',
  setup() {
    const { $axios, $config } = useContext()
    const router = useRouter()
    const nfts: NFT[] = reactive([])
    const loadingState = ref('not-loaded')

    onMounted(async () => {
      await loadNFTs()
    })

    const buyNFTs = async (nft: NFT) => {
      try {
        const web3modal = new Web3Modal()
        const connection = await web3modal.connect()
        const provider = new ethers.providers.Web3Provider(connection)

        const signer = await provider.getSigner()
        const contract = new ethers.Contract(
          $config.nftMarketAddress,
          Market.abi,
          signer
        )
        const price = ethers.utils.parseEther(nft.price.toString())
        const transaction = await contract.createMarketSale(nft.tokenId, {
          value: price,
        })
        await transaction.wait()
        router.push('/my-nfts')
      } catch (error) {
        console.log(error)
      }
    }

    const loadNFTs = async () => {
      const provider = new ethers.providers.JsonRpcProvider($config.rpcUrl)
      const marketContract = new ethers.Contract(
        $config.nftMarketAddress,
        Market.abi,
        provider
      )
      const data = await marketContract.fetchMarketItems()
      const items: NFT[] = await Promise.all(
        data.map(async (i: any) => {
          const tokenURI = await marketContract.tokenURI(i.tokenId)
          const meta = await $axios.$get(tokenURI)
          const price = ethers.utils.formatEther(i.price.toString())
          const item = {
            price,
            tokenId: i.tokenId.toString(),
            seller: i.seller,
            owner: i.owner,
            image: meta.image,
            name: meta.name,
            description: meta.description,
          }
          return item
        })
      )
      nfts.push(...items)
      loadingState.value = 'loaded'
    }
    return {
      nfts,
      loadingState,
      buyNFTs,
    }
  },
})
</script>

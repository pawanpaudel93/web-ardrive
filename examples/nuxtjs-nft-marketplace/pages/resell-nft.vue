<template>
  <div class="flex justify-center">
    <div class="w-1/2 flex flex-col pb-12">
      <input
        v-model="formInput.price"
        class="mt-2 border rounded p-4"
        placeholder="Asset Price in Matic"
      />
      <img class="rounded mt-4" width="350" :src="formInput.image" />
      <button
        class="font-bold mt-4 bg-blue-500 text-white rounded p-4 shadow-lg"
        @click="listNFTForSale"
      >
        List NFT
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {
  defineComponent,
  onMounted,
  reactive,
  useContext,
  useRoute,
  useRouter,
} from '@nuxtjs/composition-api'
import { ethers, BigNumber } from 'ethers'
import Web3Modal from 'web3modal'
import Market from '@/contract/artifacts/contracts/NFTMarketPlace.sol/NFTMarketPlace.json'

export default defineComponent({
  setup() {
    const { $config } = useContext()
    const route = useRoute()
    const router = useRouter()
    const { id, image } = route.value.query
    const formInput = reactive({
      price: '',
      image: '',
    })

    function fetchNFT() {
      if (!image) return
      formInput.image = image as string
    }

    async function listNFTForSale() {
      try {
        if (!formInput.price) return
        const web3Modal = new Web3Modal()
        const connection = await web3Modal.connect()
        const provider = new ethers.providers.Web3Provider(connection)
        const signer = provider.getSigner()

        const priceFormatted = ethers.utils.parseEther(formInput.price)
        const contract = new ethers.Contract(
          $config.nftMarketAddress,
          Market.abi,
          signer
        )
        const listingPrice = await contract
          .getListingPrice()
          .then((v: BigNumber) => v.toString())

        const tx = await contract.resellToken(id, priceFormatted, {
          value: listingPrice,
        })
        await tx.wait()
        router.push('/')
      } catch (error) {
        console.log(error)
      }
    }

    onMounted(() => {
      fetchNFT()
    })

    return {
      formInput,
      listNFTForSale,
    }
  },
})
</script>

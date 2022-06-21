<template>
  <div class="flex justify-center">
    <div class="w-1/2 flex flex-col pb-12">
      <input
        v-model="formInput.name"
        placeholder="NFT Name"
        class="mt-8 border rounded p-4"
      />
      <textarea
        v-model="formInput.description"
        placeholder="NFT Description"
        class="mt-2 border rounded p-4"
      />
      <input
        v-model="formInput.price"
        placeholder="NFT Price in Matic"
        class="mt-2 border rounded p-4"
      />
      <input type="file" name="NFT" class="my-4" @change="uploadToIPFS" />
      <img v-if="fileUrl" :src="fileUrl" class="rounded mt-4" width="350" />

      <div
        v-if="uploadProgress > 0"
        class="w-full bg-gray-200 rounded-full dark:bg-gray-700 mt-3"
      >
        <div
          class="bg-blue-600 text-xs font-medium text-blue-100 text-center p-0.5 leading-none rounded-full"
          :style="{ width: uploadProgress + '%' }"
        >
          {{ uploadProgress }}%
        </div>
      </div>

      <button
        class="font-bold mt-4 bg-blue-500 text-white rounded p-4 shadow-lg"
        @click="createNFT"
      >
        Create NFT
      </button>
    </div>
  </div>
</template>

<script lang="ts">
import {
  defineComponent,
  ref,
  reactive,
  useRouter,
  useContext,
} from '@nuxtjs/composition-api'
import { ethers, BigNumber } from 'ethers'
import { create as ipfsHttpCLient } from 'ipfs-http-client'
import Web3Modal from 'web3modal'
import Market from '@/contract/artifacts/contracts/NFTMarketPlace.sol/NFTMarketPlace.json'

const client = ipfsHttpCLient({
  host: 'ipfs.infura.io',
  port: 5001,
  protocol: 'https',
})

export default defineComponent({
  name: 'CreateItem',
  setup() {
    const router = useRouter()
    const { $config } = useContext()
    const fileUrl = ref('')
    const uploadProgress = ref(0)
    const formInput = reactive({
      price: '',
      name: '',
      description: '',
    })

    const uploadToIPFS = async (event: any) => {
      const file = event.target.files[0]
      const fileSize = file.size
      try {
        const added = await client.add(file, {
          progress: (prog: number) => {
            uploadProgress.value = parseInt(
              ((prog / fileSize) * 100).toFixed(2)
            )
          },
        })
        fileUrl.value = `https://ipfs.infura.io/ipfs/${added.path}`
      } catch (error) {
        console.log(error)
      }
    }

    const createNFT = async () => {
      const { name, description, price } = formInput
      if (!name || !description || !price) return
      const data = JSON.stringify({
        name,
        description,
        price,
        image: fileUrl.value,
      })
      try {
        const added = await client.add(data)
        const url = `https://ipfs.infura.io/ipfs/${added.path}`
        createSale(url)
      } catch (error) {
        console.log('Error uploading to IPFS', error)
      }
    }

    const createSale = async (url: String) => {
      const web3modal = new Web3Modal()
      const connection = await web3modal.connect()
      const provider = new ethers.providers.Web3Provider(connection)

      const signer = await provider.getSigner()
      const contract = new ethers.Contract(
        $config.nftMarketAddress,
        Market.abi,
        signer
      )
      const listingPrice = await contract
        .getListingPrice()
        .then((v: BigNumber) => v.toString())
      const price = ethers.utils.parseEther(formInput.price.toString())
      const transaction = await contract.createToken(url, price, {
        value: listingPrice,
      })
      await transaction.wait()

      router.push('/')
    }

    return {
      fileUrl,
      formInput,
      uploadToIPFS,
      createNFT,
      uploadProgress,
    }
  },
})
</script>

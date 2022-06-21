<template>
  <nav
    class="
      inset-x-0
      z-10
      bg-white
      border-gray-800
      px-2
      sm:px-4
      py-2.5
      border border-blue-800
      dark:bg-gray-800
    "
  >
    <div class="container flex flex-wrap justify-between items-center mx-auto">
      <nuxt-link to="/" class="flex items-center">
        <div class="logo w-10 h-10"></div>
        <span
          class="
            self-center
            text-xl
            font-semibold
            whitespace-nowrap
            dark:text-white
            text-black
          "
          >NFT MarketPlace</span
        >
      </nuxt-link>

      <button
        data-collapse-toggle="mobile-menu"
        type="button"
        class="
          inline-flex
          items-center
          p-2
          ml-3
          text-sm text-gray-500
          rounded-lg
          md:hidden
          hover:bg-gray-100
          focus:outline-none focus:ring-2 focus:ring-gray-200
          dark:text-gray-400 dark:hover:bg-gray-700 dark:focus:ring-gray-600
        "
        aria-controls="mobile-menu"
        aria-expanded="false"
      >
        <span class="sr-only">Open main menu</span>
        <svg
          class="w-6 h-6"
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill-rule="evenodd"
            d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
            clip-rule="evenodd"
          ></path>
        </svg>
        <svg
          class="hidden w-6 h-6"
          fill="currentColor"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fill-rule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clip-rule="evenodd"
          ></path>
        </svg>
      </button>
      <div id="mobile-menu" class="hidden w-full md:block md:w-auto">
        <ul
          class="
            flex flex-col
            mt-4
            md:flex-row md:space-x-8 md:mt-0 md:text-sm md:font-medium
          "
        >
          <li>
            <nuxt-link
              to="/"
              exact
              class="
                block
                py-2
                pr-4
                pl-3
                bg-black-700
                rounded
                bg-transparent
                md:text-black-700 md:p-0
                dark:text-white
              "
              >Home
            </nuxt-link>
          </li>
          <li>
            <nuxt-link
              to="/create-nft"
              exact
              class="
                block
                py-2
                pr-4
                pl-3
                bg-black-700
                rounded
                bg-transparent
                md:text-black-700 md:p-0
                dark:text-white
              "
              >Sell NFT
            </nuxt-link>
          </li>
          <li>
            <nuxt-link
              to="/my-nfts"
              exact
              class="
                block
                py-2
                pr-4
                pl-3
                bg-black-700
                rounded
                bg-transparent
                md:text-black-700 md:p-0
                dark:text-white
              "
              >My NFTs
            </nuxt-link>
          </li>
          <li>
            <nuxt-link
              to="/dashboard"
              exact
              class="
                block
                py-2
                pr-4
                pl-3
                bg-black-700
                rounded
                bg-transparent
                md:text-black-700 md:p-0
                dark:text-white
              "
              >Dashboard
            </nuxt-link>
          </li>
        </ul>
      </div>
    </div>
  </nav>
</template>

<script lang="ts">
import { defineComponent } from '@nuxtjs/composition-api'
export default defineComponent({
  name: 'HeaderComponent',
  setup() {},
})
</script>


<style >
.logo {
  box-sizing: border-box;
  margin: 0;
  min-width: 0;
  background: radial-gradient(
    75.29% 75.29% at 64.96% 24.36%,
    #dcc8d0 15.62%,
    #78c8cf 30.21%,
    #4d959e 42.71%,
    #305eb9 55.73%,
    #311f12 79.69%,
    #684232 90.62%,
    #2d1c13 100%
  );
  height: 30px;
  width: 30px;
  border-radius: 100%;
  margin-right: 10px;
}
a.nuxt-link-active {
  font-weight: bold;
}
/* exact link will show the primary color for only the exact matching link */
a.nuxt-link-exact-active {
  color: blue;
}
</style>
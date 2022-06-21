<template>
  <v-card
    max-width="600"
    class="mx-auto mt-5"
    v-if="attachments.length > 0"
  >
    <v-toolbar
      color="primary"
      dark
    >
      <v-toolbar-title>Longified TikTok Videos</v-toolbar-title>
    </v-toolbar>

    <v-list
      class="overflow-y-auto" max-height="445"
      subheader
      two-line
    >
      <v-list-item
        v-for="attachment in attachments"
        :key="attachment._id"
      >
        <v-list-item-avatar>
          <v-icon
            class="blue"
            dark
            v-text="'mdi-video'"
          ></v-icon>
        </v-list-item-avatar>

        <v-list-item-content>
          <v-list-item-title v-text="attachment.title"></v-list-item-title>

          <v-list-item-subtitle v-text="attachment.size"></v-list-item-subtitle>
        </v-list-item-content>

        <v-list-item-action>
          <v-btn icon>
            <v-icon :color="attachment.modified?'green':'red'" v-text="attachment.modified?'mdi-checkbox-marked-circle':'mdi-close-circle'"></v-icon>
          </v-btn>
        </v-list-item-action>
      </v-list-item>
    </v-list>
  </v-card>
</template>

<script>
export default {
  name: "AttachmentList",
  props: {
    attachments: {
      type: Array
    }
  }
};
</script>

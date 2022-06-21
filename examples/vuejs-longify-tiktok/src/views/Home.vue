<template>
  <v-container class="home">
    <span class="red--text">**</span><span class="green--text overline">Supported formats: webm/mp4</span>
    <vue-dropzone
      ref="myVueDropzone"
      :useCustomSlot="true"
      id="dropzone"
      :options="dropzoneOptions"
      @vdropzone-file-added="fileAdded"
    >
      <div class="dropzone-container">
        <div class="file-selector">
          <v-icon x-large>mdi-upload</v-icon><br>
            Drop Or Add Videos Here
          <p class="separator"><span>or</span></p>
          <v-btn
            rounded
            color="primary"
            dark
          >
            Browse
          </v-btn>
        </div>
      </div>
    </vue-dropzone>
    <AttachmentList
      :attachments="getTempAttachments"
    />
  </v-container>
</template>

<script>
  import vue2Dropzone from 'vue2-dropzone';
  import 'vue2-dropzone/dist/vue2Dropzone.min.css';
  import AttachmentList from "@/components/AttachmentList";
  import { saveAs } from 'file-saver';

  export default {
    name: "Home",
    data() {
      return {
        attachments: [],
        dropzoneOptions: {
          url: "/rowdy", // dummy url as url was required here
          maxFilesize: 2000,
          paramName: function(n) {
            return "file[]";
          },
          dictDefaultMessage: "Upload Files Here xD",
          acceptedFiles: ".mp4, .webm",
          includeStyling: false,
          previewsContainer: false,
          thumbnailWidth: 250,
          thumbnailHeight: 140,
          uploadMultiple: true,
          autoProcessQueue: false,
        },
        index: {},
        found: {},
        isReplacable: {},
      }
    },
    components: {
      vueDropzone: vue2Dropzone,
      AttachmentList: AttachmentList
    },
    methods: {
      formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i]; 
      },
      modifyWebm(uint8arr, id) {
        const hex2dec = (n) => parseInt(n, 16)
        const f1 = ["2a", "d7", "b1"].map(hex2dec)
        const f2 = ["44", "89"].map(hex2dec)
        const replacement = ["88", "40", "B0", "7D", "B0", "00"].map(hex2dec)
        const arrLength = uint8arr.length
        while (this.index[id] < arrLength) {
          if (f1[0]===uint8arr[this.index[id]] && f1[1]===uint8arr[this.index[id]+1] && f1[2]===uint8arr[this.index[id]+2] && this.index[id]+2 < arrLength) {
            this.found[id] = true;
            this.index[id] += 2;
          }
          if (this.found[id]) {
            if (f2[0]===uint8arr[this.index[id]] && f2[1]===uint8arr[this.index[id]+1] && this.index[id]+1 < arrLength) {
              this.isReplacable[id] = true;
              break;
            }
          }
          this.index[id] += 1
        }
        this.index[id] += 2;
        if (this.isReplacable[id]) {
          replacement.forEach((value, i) => {
            if ((this.index[id]+i)<arrLength) {
              uint8arr[this.index[id]+i] = value;
            }
          })
          return uint8arr
        }
        return
      },
      modifyMp4(uint8arr, id) {
        const hex2dec = (n) => parseInt(n, 16)
        const f = ["6d", "76", "68", "64"].map(hex2dec)
        const replacement = ["00", "00", "03", "E8", "00", "00", "13", "88"].map(hex2dec)
        const arrLength = uint8arr.length
        while (this.index[id] < arrLength) {
          if (
            f[0]===uint8arr[this.index[id]] &&
            f[1]===uint8arr[this.index[id]+1] &&
            f[2]===uint8arr[this.index[id]+2] &&
            f[3]===uint8arr[this.index[id]+3] &&
            this.index[id]+3 < arrLength
          ) {
            this.isReplacable[id] = true;
            this.index[id] += 4;
            break;
          }
          this.index[id] += 1
        }
        this.index[id] += 12;
        if (this.isReplacable[id]) {
          replacement.forEach((value, i) => {
            if ((this.index[id]+i)<arrLength) {
              uint8arr[this.index[id]+i] = value;
            }
          })
          return uint8arr
        }
        return
      },
      // function called for every file dropped or selected
      async fileAdded(file) {
        // Construct your file object to render in the UI
        let attachment = {};
        attachment._id = file.upload.uuid;
        attachment.title = file.name;
        attachment.size = this.formatBytes(file.size);
        attachment.modified = false;
        this.index[attachment._id] = 0;
        this.found[attachment._id] = false;
        this.isReplacable[attachment._id] = false;
        
        const arrBuffer = await file.arrayBuffer();
        var uint8arr = await new Uint8Array(arrBuffer);
        if (file.type == "video/mp4") {
          uint8arr = this.modifyMp4(uint8arr, attachment._id)
        } else if (file.type == "video/webm") {
          uint8arr = this.modifyWebm(uint8arr, attachment._id)
        }
        if (this.isReplacable[attachment._id]) {
          attachment.modified = true;
          this.attachments.push(attachment);
          saveAs(
            new Blob([uint8arr], {
              type: file.type,
            }),
            "longifyTikTok-" + file.name
          );
        } else {
          this.attachments.push(attachment);
        }
      },
    },
    computed: {
      getTempAttachments() {
        return this.attachments.reverse();
      }
    },
    created() {
      this.index = {}
      this.found = {}
      this.isReplacable = {}
      this.attachments = []
    }
  };
</script>

<style scoped>
.file-selector {
  padding: 55px;
  font-weight: 600;
  background-color: #f9f9f9;
  color: #4e5b69;
  z-index: -9;
}

.dropzone-container {
  /* display: flex; */
  flex-direction: column;
  border: 1px dashed #ccc;
  border-radius: 15px;
}
h1,
h2 {
  font-weight: normal;
}
ul {
  list-style-type: none;
  padding: 0;
}
li {
  display: inline-block;
  margin: 0 10px;
}
a {
  color: #42b983;
}

.separator {
  position: relative;
}
.separator:after {
  position: absolute;
  content: "";
  height: 1px;
  width: 200px;
  background: #d8d8d8;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
span {
  position: relative;
  background: #f9f9f9;
  padding: 0 4px;
  z-index: 9;
  font-size: 12px;
  color: #4e5b69;
}
</style>
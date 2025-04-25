"use client"

import dynamic from 'next/dynamic'; // Import dynamic
import Editor from "@/components/editor"

import { LayerStore } from "@/lib/layer-store"
import { ImageStore } from "@/lib/store"

const Loading = dynamic(() => import("@/components/loading"), { ssr: false });
export default function Home() {
  return (
    <ImageStore.Provider
      initialValue={{
        activeTag: "all",
        activeColor: "green",
        activeImage: "",
      }}
    >
      <LayerStore.Provider
        initialValue={{
          layerComparisonMode: false,
          layers: [
            {
              id: typeof window !== 'undefined' ? crypto.randomUUID() : '',
              url: "",
              height: 0,
              width: 0,
              publicId: "",
            },
          ],
        }}
      >
        <Loading />
        <Editor />
      </LayerStore.Provider>
    </ImageStore.Provider>
  )
}

// lib/layer-store.tsx
import { createStore } from "zustand/vanilla"
import { StoreApi, useStore } from "zustand"
import React from "react"
import { persist, createJSONStorage } from "zustand/middleware"

const createZustandContext = <TInitial, TStore extends StoreApi<any>>(
  getStore: (initial: TInitial) => TStore
) => {
  const Context = React.createContext(null as any as TStore)

  const Provider = (props: {
    children?: React.ReactNode
    initialValue: TInitial
  }) => {
    const [store] = React.useState(getStore(props.initialValue))

    return <Context.Provider value={store}>{props.children}</Context.Provider>
  }

  return {
    useContext: () => React.useContext(Context),
    Context,
    Provider,
  }
}

export type Layer = {
  publicId?: string
  width?: number
  height?: number
  url?: string
  id: string
  name?: string
  format?: string
  poster?: string
  resourceType?: string
  transcriptionURL?: string
}

type State = {
  layers: Layer[]
  addLayer: (layer: Layer) => void
  removeLayer: (id: string) => void
  setActiveLayer: (id: string) => void
  activeLayer: Layer
  updateLayer: (layer: Layer) => void
  setPoster: (id: string, posterUrl: string) => void
  setTranscription: (id: string, transcriptionURL: string) => void
  layerComparisonMode: boolean
  setLayerComparisonMode: (mode: boolean) => void
  comparedLayers: string[]
  setComparedLayers: (layers: string[]) => void
  toggleComparedLayer: (id: string) => void

  // NEW: Combiner Mode
  combinerMode: boolean
  setCombinerMode: (mode: boolean) => void

  // NEW: Sidebar States
  isToolsSidebarOpen: boolean
  isLayersSidebarOpen: boolean
  setToolsSidebarOpen: (open: boolean) => void
  setLayersSidebarOpen: (open: boolean) => void
}

const getStore = (initialState: {
  layers: Layer[]
  layerComparisonMode: boolean // Keep initial state for these if needed
}) => {
  return createStore<State>()(
    // Use persist middleware for localStorage if needed
    // For sidebar states, it's usually better NOT to persist them across sessions
    // as the layout might change or the state is confusing on reload.
    // Let's move persist outside and apply it only to the relevant parts (like layers)
    // Or keep it simple for now and don't worry about partial persistence.
    // Assuming persist is for the whole store for now, but sidebar state will be false on reload.
    persist(
      (set) => ({
        layers: initialState.layers,
        addLayer: (layer) =>
          set((state) => ({
            layers: [...state.layers, { ...layer }],
          })),
        removeLayer: (id: string) =>
          set((state) => ({
            layers: state.layers.filter((l) => l.id !== id),
          })),
        setActiveLayer: (id: string) =>
          set((state) => ({
            activeLayer:
              state.layers.find((l) => l.id === id) || state.layers[0],
          })),
        activeLayer: initialState.layers[0],
        updateLayer: (layer) =>
          set((state) => ({
            layers: state.layers.map((l) => (l.id === layer.id ? layer : l)),
          })),
        setPoster: (id: string, posterUrl: string) =>
          set((state) => ({
            layers: state.layers.map((l) =>
              l.id === id ? { ...l, poster: posterUrl } : l
            ),
          })),
        setTranscription: (id: string, transcriptionURL: string) =>
          set((state) => ({
            layers: state.layers.map((l) =>
              l.id === id ? { ...l, transcriptionURL } : l
            ),
          })),
        layerComparisonMode: initialState.layerComparisonMode,
        setLayerComparisonMode: (mode: boolean) =>
          set(() => ({
            layerComparisonMode: mode,
            comparedLayers: mode ? [] : [], // Clear compared layers when exiting comparison mode
          })),
        comparedLayers: [],
        setComparedLayers: (layers: string[]) =>
          set(() => ({
            comparedLayers: layers,
            layerComparisonMode: layers.length > 0, // Enter comparison mode if layers are selected
          })),
        toggleComparedLayer: (id: string) =>
          set((state) => {
            const newComparedLayers = state.comparedLayers.includes(id)
              ? state.comparedLayers.filter((layerId) => layerId !== id)
              : [...state.comparedLayers, id].slice(-2) // Keep only the last two
            return {
              comparedLayers: newComparedLayers,
              layerComparisonMode: newComparedLayers.length > 0,
            }
          }),

        // NEW: Combiner Mode state and setter
        combinerMode: false,
        setCombinerMode: (mode: boolean) => {
          // When entering combiner mode, close sidebars for cleanliness
          if (mode) {
             set({ combinerMode: mode, isToolsSidebarOpen: false, isLayersSidebarOpen: false });
          } else {
             set({ combinerMode: mode });
          }
        },

        // NEW: Sidebar States and setters
        isToolsSidebarOpen: false,
        isLayersSidebarOpen: false,
        setToolsSidebarOpen: (open: boolean) => set({ isToolsSidebarOpen: open }),
        setLayersSidebarOpen: (open: boolean) => set({ isLayersSidebarOpen: open }),
      }),
      { name: "layer-storage" } // Persists all state currently, including sidebar booleans (will reset to false on load)
    )
  )
}

export const LayerStore = createZustandContext(getStore)

export function useLayerStore<T>(selector: (state: State) => T) {
  const store = React.useContext(LayerStore.Context)
  if (!store) {
    throw new Error("Missing LayerStore provider")
  }
  return useStore(store, selector)
}
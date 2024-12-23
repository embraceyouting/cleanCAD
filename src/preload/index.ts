import { contextBridge , ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { create } from 'domain'

// Custom APIs for renderer
const api = {
  routechange: (callback) => ipcRenderer.on("routechange",()=>{
    callback()
  }),
  createLibrary: (callback) => ipcRenderer.on("createLibrary",()=>{
    callback()
  }),
  createSymbol: (callback) => ipcRenderer.on("createSymbol",()=>{
    callback()
  }),
  saveLibrary: (getlibraryData,getSymbolData) => ipcRenderer.on("saveLibrary",()=>{
    ipcRenderer.send("saveLibrary",getlibraryData(),getSymbolData())
  }),
  createFile:(callback)=> ipcRenderer.on("createFile",()=>{
    callback()
  }),
  saveFile:(getDiagramData)=> ipcRenderer.on("saveFile",()=>{
    ipcRenderer.send("saveFile",getDiagramData())
  }),
  openFile:(callback)=> ipcRenderer.on("openFile",(_,data)=>{
    if(data.success){
      callback(data.data)
    }
  }),
  getFilePath:(callback)=>ipcRenderer.on("getFilePath",(_,data)=>{
    callback(data)
  }),
  getSymbol:(libraryLabel,symbolLabel)=>{
    return new Promise((resolve,reject)=>{
      ipcRenderer.send("getSymbol",libraryLabel,symbolLabel)
      ipcRenderer.once("getSymbolResponse", (event, data) => {
        if(data.success){
          resolve(data.data)
        }else{
          reject(data.error)
        }
      })
    })
  },
  // getDrawFn: (name) => {
  //   return new Promise((resolve,reject)=>{
  //     ipcRenderer.send("getDrawFn",name)
  //     ipcRenderer.once("getDrawFnResponse", (event, data) => {
  //       if(data.success){
  //         resolve(data.data)
  //       }else{
  //         reject(data.error)
  //       }
  //     })
  //   })
  // },
  getSymbolLibrary:()=>{
    return new Promise((resolve,reject)=>{
      ipcRenderer.send("getSymbolLibrary")
      ipcRenderer.once("getSymbolLibraryResponse", (event, data) => {
        if(data.success){
          resolve(data.data)
        }else{
          reject(data.error)
        }
      })
    })
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}

import { EventEmitter } from 'eventemitter3'
import React, { createContext, useContext, useEffect, useState, createElement } from 'react'

export const PacketType = {
  ArrayBuffer: 'ArrayBuffer',
  Blob: 'Blob'
}

export const createWebSocket = ({ binaryType, encode, decode }) => {
  const Context = createContext({})
  const event = new EventEmitter()
  const pendingQueue = []
  const Provider = ({
    url,
    middleware,
    onError = () => {
      //
    },
    onClose = () => {
      //
    },
    children
  }) => {
    const [currentWebSocket, setCurrentWebSocket] = useState(null)

    const createWebSocket = () => {
      if (currentWebSocket) {
        return
      }
      const nextWebSocket = new WebSocket(url)
      nextWebSocket.binaryType = binaryType
      nextWebSocket.onerror = onError
      nextWebSocket.onclose = onClose
      nextWebSocket.onmessage = ({ data: packet }) => {
        const { action, data } = decode(packet)
        if (!action) {
          return
        }
        if (middleware) {
          middleware(action, ...data)
        }
        event.emit(action, ...data)
      }
      nextWebSocket.onopen = () => {
        pendingQueue.forEach(packet => nextWebSocket.send(packet))
        setCurrentWebSocket(nextWebSocket)
      }
    }
    useEffect(createWebSocket, [currentWebSocket])

    const isBroadcastable = () => !!currentWebSocket && currentWebSocket.readyState === currentWebSocket.OPEN
    const context = {
      clear(action, handler) {
        event.removeListener(action, handler)
        return this
      },
      message(action, handler) {
        event.addListener(action, handler)
        return this
      },
      messageOnce(action, handler) {
        event.once(action, handler)
        return this
      },
      broadcast(action, ...data) {
        const packet = encode(action, ...data)
        if (isBroadcastable()) {
          currentWebSocket.send(packet)
        } else {
          pendingQueue.push(packet)
        }
        return this
      },
      refresh() {
        if (isBroadcastable()) {
          currentWebSocket.close()
        }
        setCurrentWebSocket(null)
      }
    }

    return createElement(Context.Provider, { value: context }, children)
  }

  return {
    useWebSocket: () => useContext(Context),
    Consumer: Context.Consumer,
    Provider
  }
}

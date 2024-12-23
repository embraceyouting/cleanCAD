<template>
  <div>
    <canvas ref="canvas"> </canvas>
    <div class="posBtn">
      <svg @click="goToPoint" class="icon" aria-hidden="true">
        <use xlink:href="#icon-dingwei"></use>
      </svg>
    </div>
    <div class="filePath">
      {{ filePath }}
    </div>
    <div class="mousePos">
      {{ `X:${mousepos.x ? mousepos.x : 0} Y:${mousepos.y ? mousepos.y : 0}` }}
    </div>
    <div class="symbol" v-if="route.fullPath == '/page/addSymbol'">
      <router-view></router-view>
    </div>
  </div>
</template>
  
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { Diagram, Rect , Component , Text } from '../class'
import { useSymbolStore } from '../store'
const route = useRoute()
// 引用 Canvas 元素
const canvas = ref<HTMLCanvasElement | null>(null)
const filePath = ref()
let ctx: CanvasRenderingContext2D | null = null
// 网格配置
let gridSize = 20 // 初始网格尺寸
let scale = 1 // 初始缩放比例
let offsetX = 0 // 网格偏移X
let offsetY = 0 // 网格偏移Y
let isPanning = false // 是否正在拖动画布
let startPan = { x: 0, y: 0 } // 拖动起点
const mousepos = ref({} as { x: string; y: string })
const oneItem = ref(false)
let centerX
let centerY
let snappedX
let snappedY
let diagram
let currentComponent = null
let ifSnapped
let connectArr = []
let currentSymbol
let originPoint = { x: 0, y: 0, radius: 4 }
let isDragging = false
let currentSnapPoint = null
// const rect  = new Rect(centerX, centerY, 40, 40, {offsetX:0,offsetY:-30,content:"nihao",show:true}, [{ id:undefined, from_offsetX: 20, from_offsetY: 0, to_offsetX: 40, to_offsetY: 0, connectedId: undefined }])

let isFetchingSymbol = false;

// 画布尺寸更新
function resizeCanvas() {
  if (canvas.value) {
    canvas.value.width = window.innerWidth
    canvas.value.height = window.innerHeight
    draw() // 重新绘制
  }
}

function goToPoint() {
  offsetX = 0
  offsetY = 0
  scale = 1
  draw()
}

// 获取 Canvas 上下文
onMounted(() => {
  if (canvas.value) {
    ctx = canvas.value.getContext('2d')
    diagram = new Diagram(ctx)
    // diagram.addComponent(rect)
    if (ctx) {
      canvas.value.width = window.innerWidth
      canvas.value.height = window.innerHeight

      draw() // 初始绘制

      // 绑定鼠标事件
      const canvasElement = canvas.value

      window.api.saveFile(()=>{return JSON.stringify(diagram)})

      window.api.createFile(()=>{
        diagram = new Diagram(ctx)
        draw()
      })

      window.api.openFile((data)=>{
        if(data!='{}'){
          createDiagramFromFile(JSON.parse(data))
        }
        draw()
      })


      window.api.getFilePath((data)=>{
        filePath.value = data
      })

      window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' || e.key === 'Esc') {
          if (currentComponent) {
            diagram.removeComponent(currentComponent)
            currentComponent = null
          }
          currentSymbol = null
          isDragging = false
          window.placeItemName = {}
          oneItem.value = false
          isFetchingSymbol = false
          draw()
        }
        if (e.key === 'Backspace' || e.keyCode === 8) {
          if (currentComponent) {
            diagram.removeComponent(currentComponent)
            draw()
          }
        }
      })

      // 处理鼠标按下
      canvasElement.addEventListener('mousedown', (e) => {
        e.stopPropagation()
        if (e.ctrlKey) {
          isPanning = true
          isDragging = false
          startPan.x = e.offsetX
          startPan.y = e.offsetY
        } else {
          const mouseX = e.offsetX / scale - offsetX
          const mouseY = e.offsetY / scale - offsetY

          currentComponent = diagram.getComponent(mouseX, mouseY)
          useSymbolStore().$state.currentComponent = currentComponent
          if (currentComponent) {
            isDragging = true
          }

          if (ifSnapped) {
            // console.log(diagram.getPinId(snappedX, snappedY))
            // console.log(connectArr)
            if (connectArr.length == 2) {
              connectArr.shift()
              connectArr.push(diagram.getPinId(snappedX, snappedY))
              if (connectArr[0] && connectArr[1]) {
                ctx.save()
                ctx.scale(scale, scale)
                ctx.translate(offsetX, offsetY)
                diagram.connectPin(connectArr[0], connectArr[1])
                ctx.restore()
              }
            } else {
              if (connectArr.length == 1) {
                connectArr.push(diagram.getPinId(snappedX, snappedY))
                if (connectArr[0] && connectArr[1]) {
                  ctx.save()
                  ctx.scale(scale, scale)
                  ctx.translate(offsetX, offsetY)
                  diagram.connectPin(connectArr[0], connectArr[1])
                  ctx.restore()
                }
              } else {
                connectArr.push(diagram.getPinId(snappedX, snappedY))
              }
            }

            if (window.placeItemName&&JSON.stringify(window.placeItemName)!=="{}") {
                oneItem.value = false
                isFetchingSymbol = false
            }

          }
        }
      })

      // 处理鼠标移动
      canvasElement.addEventListener('mousemove', async (e) => {
        const mouseX = e.offsetX / scale - offsetX
        const mouseY = e.offsetY / scale - offsetY

        mousepos.value = { x: mouseX.toFixed(2), y: mouseY.toFixed(2) }

        // console.log(mouseX, mouseY)

        if (isPanning) {
          const dx = (e.offsetX - startPan.x) / scale
          const dy = (e.offsetY - startPan.y) / scale
          offsetX += dx
          offsetY += dy
          startPan.x = e.offsetX
          startPan.y = e.offsetY
          draw()
        } else {
          // 动态吸附到网格交叉点
          currentSnapPoint = snapToGridWithThreshold(mouseX, mouseY)

          if (window.placeItemName&&JSON.stringify(window.placeItemName)!="{}") {
            // console.log(window.placeItemName)
            if (!oneItem.value) {
              if(!isFetchingSymbol){
                isFetchingSymbol = true
                const data = await window.api.getSymbol(window.placeItemName.libraryName, window.placeItemName.symbolName)
                const componentData = JSON.parse(data)
                if(JSON.stringify(componentData) == "{}"){
                }else{
                  createComponentFromFile(componentData).then((data)=>{
                    currentComponent = data
                    diagram.addComponent(currentComponent)
                    draw()
                  })
                }
                oneItem.value = true
              }
            } else {
              if(currentComponent){
                currentComponent.changePos(currentSnapPoint.x, currentSnapPoint.y)
              }
            }
          }

          if (isDragging) {
            currentComponent.changePos(currentSnapPoint.x, currentSnapPoint.y)
          }

          draw()
          drawSnapPoint(currentSnapPoint.x, currentSnapPoint.y, currentSnapPoint.snapped)
        }
      })

      // 处理鼠标松开
      canvasElement.addEventListener('mouseup', (e) => {
        const mouseX = e.offsetX / scale - offsetX
        const mouseY = e.offsetY / scale - offsetY
        currentSnapPoint = snapToGrid(mouseX, mouseY)
        if (isDragging) {
          currentComponent.changePos(currentSnapPoint.x, currentSnapPoint.y)
        }
        isPanning = false
        isDragging = false
      })

      // 处理缩放
      canvasElement.addEventListener('wheel', (e) => {
        e.preventDefault()
        const zoomIntensity = 0.1
        const mouseX = (e.offsetX - offsetX * scale) / scale
        const mouseY = (e.offsetY - offsetY * scale) / scale

        const prevScale = scale
        if (e.deltaY < 0) {
          scale *= 1 + zoomIntensity
        } else {
          scale *= 1 - zoomIntensity
        }

        offsetX -= mouseX * (scale - prevScale)
        offsetY -= mouseY * (scale - prevScale)

        draw()
      })

      // 监听窗口大小变化
      window.addEventListener('resize', resizeCanvas)
    }
  }
})


async function createDiagramFromFile(componentsData) {
  // 创建一个数组来存储所有的组件实例
  diagram = new Diagram(ctx)

  // 遍历每个组件数据
  for (const componentData of componentsData.components) {
    try {
      // 解构组件数据中的属性
      const { centerX, centerY, toolTip, pins, symbols } = componentData;

      // 创建symbols数组，并等待所有Promise解决
      const symbolInstances = await Promise.all(symbols.map(async (symbol) => {
        const moduleExports = await import('../class/index');
        const SymbolClass = moduleExports[symbol.type];
        const currentSymbolInstance = new SymbolClass(
          symbol.from_offsetX,
          symbol.from_offsetY,
          symbol.to_offsetX,
          symbol.to_offsetY
        );
        return currentSymbolInstance;
      }));

      // 创建Component实例
      const ComponentClass = await import('../class/index').then(m => m[componentData.type]);
      const component = new ComponentClass(centerX, centerY, toolTip, pins, symbolInstances);

      // 将组件实例添加到数组中
      diagram.addComponent(component);
    } catch (err) {
      console.error('Error creating component:', err);
    }
  }

  // 返回所有组件实例的数组
  return diagram;
}


async function createComponentFromFile(componentData) {
  let { centerX, centerY, toolTip, pins, symbols } = componentData;
  // 创建symbols数组，并等待所有Promise解决
  const symbolInstances = await Promise.all(symbols.map(async (symbol) => {
    const moduleExports = await import('../class/index');
    const BasicSymbol = moduleExports[symbol.type];
    const currentBasicSymbolInstance = new BasicSymbol(
      symbol.from_offsetX,
      symbol.from_offsetY,
      symbol.to_offsetX,
      symbol.to_offsetY
    );
    return currentBasicSymbolInstance;
  }));
  // 创建Component实例
  toolTip = new Text(toolTip.offsetX, toolTip.offsetY,toolTip.show,toolTip.content)
  const component = new Component(centerX, centerY, toolTip, pins, symbolInstances);
  return component;
}

// 绘制网格
function drawGrid() {
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.value!.width, canvas.value!.height)
  ctx.save()
  ctx.scale(scale, scale)
  ctx.translate(offsetX, offsetY)

  ctx.strokeStyle = '#ccc'
  ctx.lineWidth = 0.5

  // 计算网格起点和终点
  const startX = Math.floor(-offsetX / gridSize) * gridSize
  const startY = Math.floor(-offsetY / gridSize) * gridSize
  const endX = Math.ceil((canvas.value!.width / scale - offsetX) / gridSize) * gridSize
  const endY = Math.ceil((canvas.value!.height / scale - offsetY) / gridSize) * gridSize

  for (let x = startX; x <= endX; x += gridSize) {
    ctx.beginPath()
    ctx.moveTo(x, startY)
    ctx.lineTo(x, endY)
    ctx.stroke()
  }
  for (let y = startY; y <= endY; y += gridSize) {
    ctx.beginPath()
    ctx.moveTo(startX, y)
    ctx.lineTo(endX, y)
    ctx.stroke()
  }

  ctx.restore()
}

// 吸附到网格交叉点
function snapToGridWithThreshold(x: number, y: number, threshold = 0.2) {
  // 计算吸附点的网格位置
  const snappedGridX = Math.round(x / gridSize) * gridSize
  const snappedGridY = Math.round(y / gridSize) * gridSize

  // 计算鼠标到吸附点的距离
  const distanceX = Math.abs(x - snappedGridX)
  const distanceY = Math.abs(y - snappedGridY)

  // 只有当距离小于阈值时，才认为吸附到了网格交点
  if (distanceX <= gridSize * threshold && distanceY <= gridSize * threshold) {
    mousepos.value = { x: snappedGridX.toFixed(2), y: snappedGridY.toFixed(2) }
    ifSnapped = true
    snappedX = snappedGridX
    snappedY = snappedGridY
    return { x: snappedGridX, y: snappedGridY, snapped: true }
  }

  if (distanceX <= gridSize * threshold) {
    mousepos.value.x = snappedGridX.toFixed(2)
  }

  if (distanceY <= gridSize * threshold) {
    mousepos.value.y = snappedGridY.toFixed(2)
  }

  ifSnapped = false

  // 如果没有吸附到交叉点，返回原始位置或者吸附边界
  return {
    x: distanceX <= gridSize * threshold ? snappedGridX : x,
    y: distanceY <= gridSize * threshold ? snappedGridY : y,
    snapped: false
  }
}

function snapToGrid(x: number, y: number, threshold = 0.2) {
  // 计算吸附点的网格位置
  const snappedGridX = Math.round(x / gridSize) * gridSize
  const snappedGridY = Math.round(y / gridSize) * gridSize
  return {
    x: snappedGridX,
    y: snappedGridY
  }
}

function drawOriginPoint() {
  if (!ctx) return

  ctx.save()
  ctx.scale(scale, scale)
  ctx.translate(offsetX, offsetY)
  ctx.fillStyle = 'red'
  ctx.beginPath()
  ctx.arc(originPoint.x, originPoint.y, originPoint.radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// 绘制吸附点反馈
function drawSnapPoint(x: number, y: number, snapped?: boolean) {
  if (!x || !y || !ctx) return

  if (snapped) {
    // console.log('snap point', x, y) // 调试输出
  }

  ctx.save()
  ctx.scale(scale, scale)
  ctx.translate(offsetX, offsetY)
  ctx.fillStyle = 'blue'
  ctx.beginPath()
  ctx.arc(x, y, 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// 主绘制函数
function draw() {
  if (!ctx) return
  drawGrid();
  drawOriginPoint();
  (() => {
    ctx.save()
    ctx.scale(scale, scale)
    ctx.translate(offsetX, offsetY)
    diagram.render()
    ctx.restore()
  })()
}
</script>
  
<style scoped lang="scss">

.filePath{
  position: absolute;
  left: 1%;
  bottom: 1%;
  font-size: 12px;
}

.symbol {
  width: 35%;
  height: 88%;
  position: absolute;
  right: 0%;
  top: 5%;
  border: 1px solid rgb(185, 185, 185);
  background-color: white;
  z-index: 1000;
}

.posBtn {
  position: fixed;
  right: 1%;
  bottom: 1%;
  border-radius: 50% 50%;
  height: 30px;
  width: 30px;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;
}

.mousePos {
  position: absolute;
  transform: translate(-50%, 0);
  left: 50%;
  bottom: 1%;
}
</style>
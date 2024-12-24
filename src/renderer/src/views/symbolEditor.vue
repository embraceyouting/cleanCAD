<template>
  <main>
    <div class="leftMenu">
      <!-- 搜索框 -->
      <div class="search">
        <input type="text" v-model="searchQuery" placeholder="搜索符号库" />
      </div>
      <!-- 菜单列表 -->
      <div class="menuList" v-for="(item, index) in filteredMenu" :key="item.label">
        <div
          class="menuName"
          @click="toggleMenu(index)"
          :style="item.label === chooseItem ? 'background-color: #dee2e6;' : ''"
        >
          <svg class="icon" :class="item.isOpen ? 'rotate' : ''" aria-hidden="true">
            <use xlink:href="#icon-jiantou"></use>
          </svg>
          <span>{{ item.label }}</span>
        </div>
        <ul v-if="item.isOpen">
          <li
            class="itemList"
            v-for="child in item.children"
            :key="child.label"
            @click="toggleItem(item, child.label,index)"
            @dblclick="dbtoggleItem(item.label,child.label)"
            :style="child.label === chooseItem ? 'background-color: #dee2e6;' : ''"
          >
            <span>{{ child.label }}</span>
          </li>
          <li class="itemList" v-if="addSymbolIndex==index&&isAddSymbol">
            <input v-model="addSymbolName">
          </li>
        </ul>
      </div>
      <div class="addMenuName" v-if="isAddLibrary">
        <svg class="icon" aria-hidden="true">
          <use xlink:href="#icon-jiantou"></use>
        </svg>
        <input v-model="addMenuName">
      </div>
    </div>
    <div class="rightPart">
      <div class="nav">
        <svg class="iconNav" ref="addPinIcon" aria-hidden="true">
          <use xlink:href="#icon-pin"></use>
        </svg>
        <svg class="iconNav" ref="addLine" name="Line" aria-hidden="true">
          <use xlink:href="#icon-xianduan"></use>
        </svg>
        <svg class="iconNav" ref="addText" name="Text" aria-hidden="true">
          <use xlink:href="#icon-tianjiawenzi"></use>
        </svg>
        <svg class="iconNav" ref="addCircle" name="Circle" aria-hidden="true">
          <use xlink:href="#icon-yuanhu"></use>
        </svg>
      </div>
      <div class="canvasDiv" ref="canvasDiv">
        <canvas ref="canvas"></canvas>
        <div class="mousePos">
          {{ `X:${mousepos.x ? mousepos.x : 0} Y:${mousepos.y ? mousepos.y : 0}` }}
        </div>
        <div class="btnContainer">
          <svg @click="goToPoint" class="iconBtn" aria-hidden="true">
            <use xlink:href="#icon-dingwei"></use>
          </svg>
        </div>
      </div>
    </div>
  </main>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Diagram, Component , Text } from '../class'
import createComponentFromFile from "../utils/createComponentFromFile"

const canvas = ref(null)
const canvasDiv = ref(null)
const addPinIcon = ref()
const addLine = ref()
const addText = ref()
const currentSymbol = ref({} as { name: string; drawFn: Function })
const mousepos = ref({} as { x: string; y: string })
const isAddLibrary = ref(false)
const isAddSymbol = ref(false)
const addMenuName = ref()
const addSymbolName = ref()
const currentChooseMenuIndex = ref()
const addSymbolIndex = ref()
const searchQuery = ref('')
const chooseItem = ref('')
const component = ref()

let ctx: CanvasRenderingContext2D | null = null
let gridSize = 20 // 初始网格尺寸
let scale = 1 // 初始缩放比例
let offsetX = 0 // 网格偏移X
let offsetY = 0 // 网格偏移Y
let isPanning = false // 是否正在拖动画布
let startPan = { x: 0, y: 0 } // 拖动起点
let isDragging = false // 是否在拖动元件
let currentSnapPoint = null // 网格吸附点
let centerPoint = { x: 0, y: 0, radius: 2 }
let centerX
let centerY
let diagram
let addPinArray = []
let addLineArray = []
let isAddPin = false
let isAddLine = false
let isAddText = false
let isFindToPos = false
let snapped
let snappedGridX
let snappedGridY
let snappedX
let snappedY
let currentBasicSymbol
let currentComponent


onMounted(async () => {
  if (canvas.value) {
    ctx = canvas.value.getContext('2d')
    const canvasElement = canvas.value

    diagram = new Diagram(ctx)
    resizeCanvas()
    component.value = new Component(centerX,centerY)
    diagram.addComponent(component.value)
    diagram.render()

    const menuData = await window.api.getSymbolLibrary()
    menu.value = JSON.parse(menuData)

    window.api.createLibrary(()=>{
      isAddSymbol.value = false
      addSymbolName.value = ''
      isAddLibrary.value = true
    })

    window.api.createSymbol(()=>{
      isAddLibrary.value = false
      addMenuName.value = ''
      isAddSymbol.value = true
      addSymbolIndex.value = currentChooseMenuIndex.value
      if(addSymbolIndex.value!=-1){
        menu.value[addSymbolIndex.value].isOpen = true
      }
    })

    window.api.saveLibrary(
      ()=>{
        return JSON.stringify(menu.value)
      },
      ()=>{
        return JSON.stringify({libraryName:menu.value[currentChooseMenuIndex.value].label,symbolName:chooseItem.value,content:component.value})
      }
    )

    addPinIcon.value.addEventListener('click', () => {
      isAddPin = true
      isAddLine = false
      isAddText = false
      addLineArray = []
    })

    addLine.value.addEventListener('click', () => {
      isAddLine = true
      isAddPin = false
      isAddText = false
      addPinArray = []
    })

    addText.value.addEventListener('click',async(e) => {
      if(!component.value.toolTip){
        const mouseX = e.offsetX / scale - offsetX
        const mouseY = e.offsetY / scale - offsetY
        const BasicSymbolName = addText.value.getAttribute('name')
        const moduleExports = await import('../class/index')
        const moduleExportsWithIndexSignature = moduleExports as { [key: string]: any }
        const BasicSymbol = moduleExportsWithIndexSignature[BasicSymbolName]
        currentBasicSymbol = new BasicSymbol(mouseX - centerX, mouseY - centerY,true,"nihao")
        component.value.addToolTip(currentBasicSymbol)
        isAddText = true
        isAddLine = false
        isAddPin = false
        addPinArray = []
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        isAddLibrary.value = false
        addMenuName.value = ''
        isAddSymbol.value = false
        addSymbolName.value = ''
        isAddPin = false
        isAddLine = false
        if(isAddText){
          component.value.removeToolTip()
          isAddText = false
        }
        addPinArray = []
        addLineArray = []
        draw()
      }

      if(e.code == "Enter"&&isAddLibrary.value){
        if(addMenuName.value&&menu.value.map((item)=>item.label).indexOf(addMenuName.value)==-1){
          isAddLibrary.value = false
          menu.value.push(
            {
              label: addMenuName.value,
              isOpen: false,
              children: []
            }
          )
          addMenuName.value = ''
        }
      }

      if (e.key === 'Backspace' || e.keyCode === 8) {
        if (currentComponent) {
          diagram.removeComponent(currentComponent)
          draw()
        }
      }

      if(e.code == "Enter"&&isAddSymbol.value){
        if(addSymbolName.value){
          isAddSymbol.value = false
          menu.value[currentChooseMenuIndex.value].children.push(
            {
              label: addSymbolName.value,
            }
          )
          addSymbolName.value = ''
          addSymbolIndex.value = -1
        }
      }
    })

    // 处理鼠标按下
    canvasElement.addEventListener('mousedown', async (e) => {
      if (e.ctrlKey) {
        isPanning = true
        startPan.x = e.offsetX
        startPan.y = e.offsetY
      } else {
        const mouseX = e.offsetX / scale - offsetX
        const mouseY = e.offsetY / scale - offsetY

        currentComponent = diagram.getComponent(mouseX, mouseY)
        if (currentComponent) {
          isDragging = true
        }

        if (snapped && isAddPin) {
          addPinArray.push({ x: snappedX - centerX, y: snappedY - centerY })
          if (addPinArray.length == 2) {
            component.value.addPin(
              addPinArray[0].x,
              addPinArray[0].y,
              addPinArray[1].x,
              addPinArray[1].y
            )
            isAddPin = false
            addPinArray = []
            draw()
            console.log(JSON.stringify(component.value))
          }
        }

        if (snapped && isAddLine) {
          if (addLineArray.length == 0) {
            addLineArray.push({ x: snappedX - centerX, y: snappedY - centerY })
            const BasicSymbolName = addLine.value.getAttribute('name')
            const moduleExports = await import('../class/index')
            const moduleExportsWithIndexSignature = moduleExports as { [key: string]: any }
            const BasicSymbol = moduleExportsWithIndexSignature[BasicSymbolName]
            currentBasicSymbol = new BasicSymbol(addLineArray[0].x, addLineArray[0].y, mouseX - centerX, mouseY - centerY)
            component.value.addSymbol(currentBasicSymbol)
            draw()
            isFindToPos = true
          } else if (addLineArray.length == 1 &&(addLineArray[0].x != snappedX || addLineArray[0].y != snappedY)) {
            addLineArray.push({ x: snappedX - centerX, y: snappedY - centerY })
            currentBasicSymbol.preview(addLineArray[1].x, addLineArray[1].y)
            console.log(component.value)
            addLineArray = []
            isFindToPos = false
            currentBasicSymbol = null
            console.log(JSON.stringify(component.value))
          }
        }

        if(snapped && isAddText){
          isAddText = false
          currentBasicSymbol.preview(snappedX - centerX, snappedY - centerY)
        }

      }
    })

    // 处理鼠标移动
    canvasElement.addEventListener('mousemove', (e) => {
      const mouseX = e.offsetX / scale - offsetX
      const mouseY = e.offsetY / scale - offsetY

      mousepos.value = { x: mouseX.toFixed(2), y: mouseY.toFixed(2) }

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

        if (isAddLine && isFindToPos) {
          currentBasicSymbol.preview(mouseX - centerX, mouseY - centerY)
        }
        if (isAddText){
          currentBasicSymbol.preview(mouseX - centerX, mouseY - centerY)
        }

        if (isDragging) {
          currentComponent.changePos(mouseX, mouseY)
        }

        draw()
        drawSnapPoint(currentSnapPoint.x, currentSnapPoint.y, currentSnapPoint.snapped)
      }
    })

    // 处理鼠标松开
    canvasElement.addEventListener('mouseup', () => {
      if (isDragging) {
        currentComponent.changePos(snappedGridX, snappedGridY)
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
      let newScale = scale

      if (e.deltaY < 0) {
        newScale *= 1 + zoomIntensity
      } else {
        newScale *= 1 - zoomIntensity
      }

      // 限制缩放倍数在0.5到2之间
      newScale = Math.max(0.5, Math.min(2, newScale))

      // 如果新的缩放倍数超出限制，则不执行缩放
      if (newScale !== prevScale) {
        scale = newScale
        offsetX -= mouseX * (scale - prevScale)
        offsetY -= mouseY * (scale - prevScale)
        draw()
      }
    })
  }
  window.addEventListener('resize', resizeCanvas)
})

// 调整画布大小
const resizeCanvas = () => {
  canvas.value.width = canvasDiv.value.clientWidth
  canvas.value.height = canvasDiv.value.clientHeight
  centerX = Math.floor(canvas.value.width / (2 * gridSize)) * gridSize
  centerY = Math.floor(canvas.value.height / (2 * gridSize)) * gridSize
  centerPoint.x = centerX
  centerPoint.y = centerY
  if (component.value) {
    component.value.changePos(centerX, centerY)
  }
  draw()
}

// 网格绘制
function drawGrid() {
  if (!ctx) return

  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)

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

// 吸附到网格
function snapToGridWithThreshold(x: number, y: number, threshold = 0.2) {
  // 计算吸附点的网格位置
  snappedGridX = Math.round(x / gridSize) * gridSize
  snappedGridY = Math.round(y / gridSize) * gridSize

  // 计算鼠标到吸附点的距离
  const distanceX = Math.abs(x - snappedGridX)
  const distanceY = Math.abs(y - snappedGridY)

  // 只有当距离小于阈值时，才认为吸附到了网格交点
  if (distanceX <= gridSize * threshold && distanceY <= gridSize * threshold) {
    snappedX = snappedGridX
    snappedY = snappedGridY
    mousepos.value = { x: snappedX.toFixed(2), y: snappedY.toFixed(2) }
    snapped = true
    return { x: snappedX, y: snappedY, snapped: true }
  }

  snapped = false

  if (distanceX <= gridSize * threshold) {
    mousepos.value.x = snappedGridX.toFixed(2)
  }

  if (distanceY <= gridSize * threshold) {
    mousepos.value.y = snappedGridY.toFixed(2)
  }

  // 如果没有吸附到交叉点，返回原始位置或者吸附边界
  return {
    x: distanceX <= gridSize * threshold ? snappedGridX : x,
    y: distanceY <= gridSize * threshold ? snappedGridY : y,
    snapped: false
  }
}

// 吸附提示绘制
// 绘制吸附点反馈
function drawSnapPoint(x: number, y: number, snapped?: boolean) {
  if (!ctx) return

  if (snapped) {
    // console.log('snap point', x, y) // 调试输出
  }

  ctx.save()
  ctx.scale(scale, scale)
  ctx.translate(offsetX, offsetY)
  ctx.fillStyle = 'blue'
  ctx.beginPath()
  ctx.arc(x, y, 2, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function drawPoint() {
  if (!ctx) return
  ctx.save()
  ctx.scale(scale, scale)
  ctx.translate(offsetX, offsetY)
  ctx.fillStyle = 'red'
  ctx.strokeStyle = 'none'
  ctx.beginPath()
  ctx.arc(centerPoint.x, centerPoint.y, centerPoint.radius, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

// 主绘制函数
function draw() {
  if (!ctx) return
  drawGrid()
  drawPoint()
  ;(() => {
    ctx.save()
    ctx.scale(scale, scale)
    ctx.translate(offsetX, offsetY)
    diagram.render()
    ctx.restore()
  })()
}

// 符号库和选择逻辑
const menu = ref([
  {
    label: '符号库1',
    isOpen: false,
    children: [{ label: 'rect' }, { label: 'triangle' }]
  }
])



const filteredMenu = computed(() => {
  if (!searchQuery.value) {
    return menu.value // 如果没有输入搜索条件，返回完整菜单
  }

  return menu.value
    .map((item) => {
      // 过滤出匹配的子项
      const filteredChildren = item.children.filter((child) =>
        child.label.toLowerCase().includes(searchQuery.value.toLowerCase())
      )

      // 父项本身匹配或者有子项匹配时，才保留
      const hasMatchingChild =
        filteredChildren.length > 0 ||
        item.label.toLowerCase().includes(searchQuery.value.toLowerCase())

      // 如果父项匹配搜索关键字，或者有匹配的子项，保留该父项及其所有子项
      if (hasMatchingChild) {
        return {
          ...item,
          children: item.label.toLowerCase().includes(searchQuery.value.toLowerCase())
            ? item.children
            : filteredChildren, // 只返回匹配的子项
          isOpen: true // 展开匹配的父项
        }
      }
      // 如果父项不匹配，也不包含匹配的子项，则不返回该父项
    })
    .filter(Boolean) // 过滤掉未返回的项
})

const toggleMenu = (index) => {
  menu.value[index].isOpen = !menu.value[index].isOpen
  currentChooseMenuIndex.value = index
  addSymbolIndex.value = -1
}

const toggleItem = (item, label,index) => {
  chooseItem.value = label
  currentChooseMenuIndex.value = index
  addSymbolIndex.value = -1
}

const dbtoggleItem = async (libraryLabel,symbolLabel) => {
  diagram.reSetPinId()
  isAddLine = false
  isAddPin = false
  isAddText = false
  addPinArray = []
  addLineArray = []
  if (searchQuery.value) {
    searchQuery.value = ''
  }
  const data = await window.api.getSymbol(libraryLabel, symbolLabel)
  console.log(data)
  const componentData = JSON.parse(data)
  chooseItem.value = symbolLabel
  if(JSON.stringify(componentData) == "{}"){
    diagram.removeComponent(component.value)
    component.value = new Component(centerX,centerY)
    diagram.addComponent(component.value)
    draw()
  }else{
    if (component.value) {
      diagram.removeComponent(component.value)
    }
    createComponentFromFile(componentData).then((data)=>{
      component.value = data
      diagram.addComponent(component.value)
      draw()
    })
  }
  draw()
}

function goToPoint() {
  gridSize = 20
  scale = 1
  offsetX = 0
  offsetY = 0
  isPanning = false
  startPan = { x: 0, y: 0 }
  isDragging = false
  currentSnapPoint.value = { x: 0, y: 0, snapped: false }
  draw()
}


</script>

<style lang="scss" scoped>
.icon {
  height: 0.8em;
  width: 0.8em;
  margin-right: 5px;
  vertical-align: center;
}

.iconBtn {
  height: 100%;
  width: 100%;
  vertical-align: center;
}

.iconNav {
  height: 20px;
  width: 20px;
  padding: 2px;
  &:hover {
    cursor: pointer;
    background-color: #d7d7d7;
  }
}

.rotate {
  transform: rotate(90deg);
}

main {
  display: flex;
  height: 100vh;
  width: 100vw;

  .leftMenu {
    flex: 1;
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto; /* 使内容超出时出现垂直滚动条 */
    border: 1px solid #dee2e6;
    font-size: 14px;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;

    .search {
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 5px 0;

      input {
        width: 90%;
        outline: none;
      }
    }
  }

  .rightPart {
    flex: 5;
    height: 100%;
    display: flex;
    border: 1px solid #dee2e6;
    flex-direction: column;

    .nav {
      height: 30px;
      display: flex;
      gap: 10px;
      padding: 0px 10px;
      align-items: center;
    }

    .canvasDiv {
      background-color: #f8f9fa;
      height: 100%;
      position: relative;

      .mousePos {
        position: absolute;
        transform: translate(-50%, 0);
        left: 50%;
        bottom: 1%;
        font-size: 14px;
      }

      .btnContainer {
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
    }
  }

  .menuList {
    width: 100%;
    .menuName {
      height: 20px;
      width: 100%;
      display: flex;
      align-items: center;
      cursor: pointer;
      padding: 2px;
      box-sizing: border-box;
    }

    ul > li {
      padding: 2px 0;
      padding-left: 20px;
      display: flex;
      cursor: pointer;
      &:hover {
        background-color: #f8f9fa;
      }
      input{
        width: 95%;
        outline:none;
      }
    }
  }

  .addMenuName{
    height: 20px;
    width: 100%;
    display: flex;
    align-items: center;
    cursor: pointer;
    padding: 2px;
    box-sizing: border-box;

    .icon{
      height: 0.9em;
      width: 0.9em;
      margin-right: 5px;
      vertical-align: center;
    }

    input{
      width: 100%;
      height: 80%;
      outline: none;
    }

  }

}
</style>

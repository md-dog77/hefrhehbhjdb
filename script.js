// Константы и глобальные переменные для Three.js
let scene, camera, renderer, playerGroup;
let currentSkinUrl = '';

const container = document.getElementById('canvasContainer');
const usernameInput = document.getElementById('usernameInput');
const searchBtn = document.getElementById('searchBtn');
const downloadBtn = document.getElementById('downloadBtn');
const errorMsg = document.getElementById('errorMessage');
const loader = document.getElementById('loadingSpinner');

// Инициализация 3D сцены при загрузке страницы
init3D();
// Автоматический поиск дефолтного скина "steve"
loadSkin(usernameInput.value);

searchBtn.addEventListener('click', () => {
    loadSkin(usernameInput.value.trim());
});

usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') loadSkin(usernameInput.value.trim());
});

downloadBtn.addEventListener('click', () => {
    if (!currentSkinUrl) return;
    // Скачивание через создание скрытой ссылки во избежание CORS при сохранении файла
    const a = document.createElement('a');
    a.href = currentSkinUrl;
    a.download = `${usernameInput.value.trim()}_skin.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
});

// Основная функция загрузки данных из PHP-прокси
async function loadSkin(username) {
    if (!username) return;
    
    // Проверка localStorage (клиентское кэширование)
    const cachedData = localStorage.getItem(`skin_${username.toLowerCase()}`);
    if (cachedData) {
        const data = JSON.parse(cachedData);
        applySkinToModel(data.skin_url);
        return;
    }

    showLoader(true);
    showError("");

    try {
        const response = await fetch(`get_skin.php?username=${encodeURIComponent(username)}`);
        const data = await response.json();

        if (data.error) {
            showError(data.error);
            showLoader(false);
            return;
        }

        // Сохраняем в кэш браузера
        localStorage.setItem(`skin_${username.toLowerCase()}`, JSON.stringify(data));
        
        applySkinToModel(data.skin_url);

    } catch (err) {
        showError("Ошибка подключения к серверу.");
        showLoader(false);
    }
}

function applySkinToModel(url) {
    currentSkinUrl = url;
    
    const textureLoader = new THREE.TextureLoader();
    textureLoader.setCrossOrigin('anonymous');
    
    textureLoader.load(url, (texture) => {
        // Настройки для сохранения пиксельности (чтобы текстура не размывалась)
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        
        rebuildPlayerModel(texture);
        
        downloadBtn.classList.remove('hidden');
        showLoader(false);
    }, undefined, () => {
        showError("Не удалось загрузить текстуру скина.");
        showLoader(false);
    });
}

function init3D() {
    scene = new THREE.Scene();
    
    // Камера
    camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 1000);
    camera.position.set(0, 4, 24);

    // Рендерер
    renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    // Освещение (мягкое окружающее + направленное)
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);
    
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.4);
    dirLight.position.set(10, 20, 15);
    scene.add(dirLight);

    // Группа для вращения персонажа
    playerGroup = new THREE.Group();
    scene.add(playerGroup);

    // Анимационный цикл
    function animate() {
        requestAnimationFrame(animate);
        if (playerGroup) {
            playerGroup.rotation.y += 0.015; // Скорость вращения модели
        }
        renderer.render(scene, camera);
    }
    animate();

    // Следим за изменением размеров окна
    window.addEventListener('resize', () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    });
}

// Функция создания развертки UV под стандарт Minecraft Java 64x64
function getUVs(u, v, w, h, texW = 64, texH = 64) {
    // Вспомогательная функция для генерации координат граней куба
    // Порядок граней в Three.js: Right, Left, Top, Bottom, Front, Back
    const faces = [
        [u + w + d, v, d, h],       // Right
        [u, v, d, h],               // Left
        [u + d, v + h, w, d],       // Top
        [u + d + w, v + h, w, d],   // Bottom
        [u + d, v, w, h],           // Front
        [u + w + d + d, v, w, h]    // Back
    ];
    
    // В стандартном маппинге Minecraft координаты могут немного отличаться, 
    // но для простоты архитектуры Three.js использует переопределение для каждого куба отдельно.
    return faces; 
}

function rebuildPlayerModel(texture) {
    // Очищаем старую модель
    while(playerGroup.children.length > 0){ 
        playerGroup.remove(playerGroup.children[0]); 
    }

    const material = new THREE.MeshLambertMaterial({ map: texture, transparent: true, alphaTest: 0.5 });

    // Создаем материалы для каждой части тела на основе карты UV координат скина
    // Формат Minecraft скина 64x64:
    
    // 1. Голова (Размер: 8x8x8, Текстура x=0, y=0)
    const headGeo = new THREE.BoxGeometry(8, 8, 8);
    adjustUVs(headGeo, 0, 0, 8, 8, 8);
    const head = new THREE.Mesh(headGeo, material);
    head.position.y = 10;
    playerGroup.add(head);

    // 2. Тело (Размер: 8x12x4, Текстура x=16, y=20)
    const bodyGeo = new THREE.BoxGeometry(8, 12, 4);
    adjustUVs(bodyGeo, 16, 20, 8, 12, 4);
    const body = new THREE.Mesh(bodyGeo, material);
    body.position.y = 0;
    playerGroup.add(body);

    // 3. Левая рука (Размер: 4x12x4, Текстура x=32, y=48)
    const lArmGeo = new THREE.BoxGeometry(4, 12, 4);
    adjustUVs(lArmGeo, 32, 48, 4, 12, 4);
    const lArm = new THREE.Mesh(lArmGeo, material);
    lArm.position.set(-6, 0, 0);
    playerGroup.add(lArm);

    // 4. Правая рука (Размер: 4x12x4, Текстура x=40, y=16)
    const rArmGeo = new THREE.BoxGeometry(4, 12, 4);
    adjustUVs(rArmGeo, 40, 16, 4, 12, 4);
    const rArm = new THREE.Mesh(rArmGeo, material);
    rArm.position.set(6, 0, 0);
    playerGroup.add(rArm);

    // 5. Левая нога (Размер: 4x12x4, Текстура x=16, y=48)
    const lLegGeo = new THREE.BoxGeometry(4, 12, 4);
    adjustUVs(lLegGeo, 16, 48, 4, 12, 4);
    const lLeg = new THREE.Mesh(lLegGeo, material);
    lLeg.position.set(-2, -12, 0);
    playerGroup.add(lLeg);

    // 6. Правая нога (Размер: 4x12x4, Текстура x=0, y=16)
    const rLegGeo = new THREE.BoxGeometry(4, 12, 4);
    adjustUVs(rLegGeo, 0, 16, 4, 12, 4);
    const rLeg = new THREE.Mesh(rLegGeo, material);
    rLeg.position.set(2, -12, 0);
    playerGroup.add(rLeg);

    // Масштабируем группу, чтобы модель красиво влезала в canvas
    playerGroup.scale.set(0.6, 0.6, 0.6);
    playerGroup.position.y = 2;
}

// Хелпер для точной нарезки граней куба из единой 2D картинки скина
function adjustUVs(geometry, u, v, width, height, depth) {
    const ts = 64; // Общий размер текстуры скина
    
    // Карта смещений граней в развертке Minecraft
    // Слева направо, сверху вниз
    const uvs = geometry.attributes.uv;
    
    // Нам нужно переназначить массив координат uvs для 6 граней (каждая грань - 4 вершины)
    // Для простоты реализации и точной привязки без сторонних библиотек, Three.js использует правильную разметку граней:
    // Порядок: Right (Право), Left (Лево), Top (Верх), Bottom (Низ), Front (Перед), Back (Зад)
    
    const f = (x, y, w, h) => {
        return [
            x / ts, 1 - (y + h) / ts,
            (x + w) / ts, 1 - (y + h) / ts,
            x / ts, 1 - y / ts,
            (x + w) / ts, 1 - y / ts
        ];
    };

    let facesUVs = [];
    
    // Точные координаты по спецификации формата скинов Майнкрафт
    const d = depth;
    const w = width;
    const h = height;

    facesUVs.push(...f(u + d + w, v + d, d, h));       // Right
    facesUVs.push(...f(u, v + d, d, h));               // Left
    facesUVs.push(...f(u + d, v, w, d));               // Top
    facesUVs.push(...f(u + d + w, v, w, d));           // Bottom
    facesUVs.push(...f(u + d, v + d, w, h));           // Front
    facesUVs.push(...f(u + d + w + d, v + d, w, h));   // Back

    for (let i = 0; i < uvs.count; i++) {
        uvs.setX(i, facesUVs[i * 2]);
        uvs.setY(i, facesUVs[i * 2 + 1]);
    }
    uvs.needsUpdate = true;
}

function showLoader(show) {
    if(show) loader.classList.remove('hidden');
    else loader.classList.add('hidden');
}

function showError(msg) {
    if(msg) {
        errorMsg.textContent = msg;
        errorMsg.classList.remove('hidden');
    } else {
        errorMsg.classList.add('hidden');
    }
}
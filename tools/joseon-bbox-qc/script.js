const qcToolButton = document.querySelector("#qcToolButton");
const introModal = document.querySelector("#introModal");
const closeIntroButton = document.querySelector("#closeIntroButton");
const loginModal = document.querySelector("#loginModal");
const loginForm = document.querySelector("#loginForm");
const authStatus = document.querySelector("#authStatus");
const workspace = document.querySelector("#workspace");
const workspaceText = document.querySelector("#workspaceText");
const startToolButton = document.querySelector("#startToolButton");
const introText = document.querySelector("#introText");
const dots = Array.from(document.querySelectorAll(".dot"));

const slides = [
  "이미지와 라벨 파일을 업로드하고, 클래스와 박스 오류를 한 화면에서 확인합니다.",
  "검수 기준에 맞지 않는 박스와 누락 가능성이 있는 데이터를 빠르게 찾습니다.",
  "로그인 후 프로젝트별 검수 작업을 시작할 수 있습니다."
];

let slideIndex = 0;
let carouselTimer;

function showIntro() {
  slideIndex = 0;
  updateSlide();
  introModal.classList.remove("hidden");
  clearInterval(carouselTimer);
  carouselTimer = setInterval(() => {
    slideIndex = (slideIndex + 1) % slides.length;
    updateSlide();
  }, 2300);
}

function updateSlide() {
  introText.textContent = slides[slideIndex];
  dots.forEach((dot, index) => {
    dot.classList.toggle("active", index === slideIndex);
  });
}

function showLogin() {
  loginModal.classList.remove("hidden");
  const emailInput = loginForm.querySelector("input[type='email']");
  emailInput.focus();
}

function activateTool() {
  authStatus.textContent = "로그인 완료";
  authStatus.classList.add("ready");
  workspace.classList.remove("locked");
  workspaceText.textContent = "검수 툴이 활성화되었습니다. 작업을 시작할 수 있습니다.";
  startToolButton.disabled = false;
}

qcToolButton.addEventListener("click", showIntro);

closeIntroButton.addEventListener("click", () => {
  clearInterval(carouselTimer);
  introModal.classList.add("hidden");
  showLogin();
});

loginForm.addEventListener("submit", (event) => {
  event.preventDefault();
  loginModal.classList.add("hidden");
  activateTool();
});

startToolButton.addEventListener("click", () => {
  workspaceText.textContent = "현재는 데모 화면입니다. 실제 검수 기능 파일을 연결하면 바로 사용할 수 있습니다.";
});

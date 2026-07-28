const qcToolButton = document.querySelector("#qcToolButton");
const introModal = document.querySelector("#introModal");
const closeIntroButton = document.querySelector("#closeIntroButton");
const emailModal = document.querySelector("#emailModal");
const emailForm = document.querySelector("#emailForm");
const authStatus = document.querySelector("#authStatus");
const workspace = document.querySelector("#workspace");
const workspaceText = document.querySelector("#workspaceText");
const startToolButton = document.querySelector("#startToolButton");
const introText = document.querySelector("#introText");
const dots = Array.from(document.querySelectorAll(".dot"));

const slides = [
  "이미지와 라벨 파일을 업로드하고, 클래스와 박스 오류를 한 화면에서 확인합니다.",
  "검수 기준에 맞지 않는 박스와 누락 가능성이 있는 데이터를 빠르게 찾습니다.",
  "이메일 확인 후 프로젝트별 검수 작업을 시작할 수 있습니다."
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

function showEmailGate() {
  emailModal.classList.remove("hidden");
  const emailInput = emailForm.querySelector("input[type='email']");
  emailInput.focus();
}

function activateTool() {
  authStatus.textContent = "이메일 확인 완료";
  authStatus.classList.add("ready");
  workspace.classList.remove("locked");
  workspaceText.textContent = "검수 툴로 이동합니다.";
  startToolButton.disabled = false;
  window.location.href = "./app";
}

qcToolButton.addEventListener("click", showIntro);

closeIntroButton.addEventListener("click", () => {
  clearInterval(carouselTimer);
  introModal.classList.add("hidden");
  showEmailGate();
});

emailForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const emailInput = emailForm.querySelector("input[type='email']");
  if (!emailInput.checkValidity()) {
    emailInput.reportValidity();
    return;
  }
  emailModal.classList.add("hidden");
  activateTool();
});

startToolButton.addEventListener("click", () => {
  window.location.href = "./app";
});

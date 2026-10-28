// 라이트/다크 모드 저장 키와, 첫 화면을 그리기 전에 모드를 정하는 스크립트(서버 layout 의 <head> 에 넣는다 — 깜빡임 방지)
export const THEME_KEY = "goseoul.theme";

export const THEME_INIT_SCRIPT = `try{var t=localStorage.getItem("${THEME_KEY}");if(t!=="light"&&t!=="dark")t=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.classList.toggle("dark",t==="dark")}catch(e){}`;

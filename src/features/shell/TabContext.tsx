// 탭 안의 화면이 자기 탭이 활성인지 알 수 있게 한다(숨겨진 탭의 단축키 등을 끄기 위해).
"use client";

import { createContext, useContext } from "react";

export const TabActiveContext = createContext(true);

export const useTabActive = () => useContext(TabActiveContext);

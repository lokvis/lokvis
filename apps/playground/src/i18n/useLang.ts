/**
 * useLang - React hook，获取当前页面语言
 *
 * 优先从 `<html lang>` 属性读取（Astro SSR 已正确设置），
 * 避免解析 URL 字符串导致的首次渲染闪烁（先英文后中文）。
 *
 * client:only 组件第一次渲染时，document.documentElement.lang 已经是正确值，
 * 因此 lazy initializer 能立即返回正确语言，无需等待 useEffect 修正。
 *
 * 监听 popstate 事件以支持 SPA 式导航（如 View Transitions）。
 */
import { useState, useEffect } from 'react';
import { getLangFromUrl } from './utils';
import { defaultLang, type Language } from './config';

/** 从 document.documentElement.lang 读取语言，回退到 URL 解析 */
function detectLang(): Language {
  if (typeof document === 'undefined') return defaultLang;
  const htmlLang = document.documentElement.lang;
  if (htmlLang === 'en' || htmlLang === 'zh') return htmlLang;
  // 回退方案：从 URL 解析
  return getLangFromUrl(window.location.href);
}

export function useLang(): Language {
  const [lang, setLang] = useState<Language>(() => {
    if (typeof window === 'undefined') return defaultLang;
    return detectLang();
  });

  useEffect(() => {
    // 语言切换是整页导航（<a> 链接），会重新加载页面；
    // popstate 监听仅用于浏览器前进/后退按钮
    const update = () => setLang(detectLang());
    window.addEventListener('popstate', update);
    return () => window.removeEventListener('popstate', update);
  }, []);

  return lang;
}

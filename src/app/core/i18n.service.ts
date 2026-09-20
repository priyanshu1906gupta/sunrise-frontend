import { Injectable, signal } from '@angular/core';
import en from '../../assets/i18n/en.json';
import hi from '../../assets/i18n/hi.json';

const dictionaries: Record<'en' | 'hi', Record<string, string>> = {
  en: en as Record<string, string>,
  hi: hi as Record<string, string>
};

function storedLang(): 'en' | 'hi' {
  return localStorage.getItem('sunrise_lang') === 'hi' ? 'hi' : 'en';
}

@Injectable({ providedIn: 'root' })
export class I18nService {
  readonly lang = signal<'en' | 'hi'>(storedLang());
  readonly dict = signal<Record<string, string>>(dictionaries[storedLang()]);

  init(): void {
    this.apply(this.lang());
  }

  setLang(lang: 'en' | 'hi'): void {
    localStorage.setItem('sunrise_lang', lang);
    this.apply(lang);
  }

  t(key: string): string {
    return this.dict()[key] ?? key;
  }

  private apply(lang: 'en' | 'hi'): void {
    this.lang.set(lang);
    this.dict.set(dictionaries[lang]);
  }
}

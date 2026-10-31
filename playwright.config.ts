import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'tests/e2e',timeout:90000,fullyParallel:false,workers:1,use:{baseURL:'http://127.0.0.1:5173',viewport:{width:1440,height:1000},headless:true,launchOptions:{executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']}},reporter:'list'});

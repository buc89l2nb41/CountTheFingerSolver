/**
 * countthefingers.com 네트워크 요청 분석 스크립트
 * POST 요청 및 정답 판별 API 탐지
 */
import puppeteer from 'puppeteer';

const capturedRequests = [];

async function analyze() {
  console.log('브라우저 시작 중...');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  try {
    const page = await browser.newPage();

    // 모든 네트워크 요청 캡처
    await page.setRequestInterception(true);
    
    page.on('request', (request) => {
      const reqInfo = {
        url: request.url(),
        method: request.method(),
        postData: request.postData(),
        headers: request.headers()
      };
      capturedRequests.push(reqInfo);
      
      if (request.method() === 'POST') {
        console.log('\n=== POST 요청 발견 ===');
        console.log('URL:', request.url());
        console.log('Headers:', JSON.stringify(Object.fromEntries(request.headers()), null, 2));
        if (request.postData()) {
          console.log('Post Data:', request.postData());
        }
      }
      request.continue();
    });

    // 응답도 로깅 (API 응답 확인용)
    page.on('response', async (response) => {
      const request = response.request();
      if (request.method() === 'POST') {
        try {
          const contentType = response.headers()['content-type'] || '';
          if (contentType.includes('json')) {
            const body = await response.text();
            console.log('\n=== POST 응답 ===');
            console.log('URL:', request.url());
            console.log('Status:', response.status());
            console.log('Body:', body.substring(0, 500));
          }
        } catch (e) {
          // 응답 본문 읽기 실패 무시
        }
      }
    });

    console.log('countthefingers.com 방문 중...');
    await page.goto('https://countthefingers.com/', {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // 페이지가 로드된 후 잠시 대기 (게임 시작 시 추가 요청 캡처)
    await new Promise(r => setTimeout(r, 3000));

    // 게임 플레이 시뮬레이션 - 이미지 클릭 후 답 제출 시도
    const snapshot = await page.evaluate(() => {
      return {
        html: document.body ? document.body.innerHTML.substring(0, 2000) : '',
        scripts: Array.from(document.scripts).map(s => s.src).filter(Boolean)
      };
    });

    console.log('\n=== 페이지 스크립트 목록 ===');
    snapshot.scripts.forEach(s => console.log(s));

    // POST 요청만 필터링하여 요약
    const postRequests = capturedRequests.filter(r => r.method === 'POST');
    
    console.log('\n\n========== 분석 결과 요약 ==========');
    console.log('총 POST 요청 수:', postRequests.length);
    postRequests.forEach((req, i) => {
      console.log(`\n[${i + 1}] ${req.url}`);
      if (req.postData) console.log('    Data:', req.postData);
    });

  } catch (error) {
    console.error('오류:', error.message);
  } finally {
    await browser.close();
  }
}

analyze();

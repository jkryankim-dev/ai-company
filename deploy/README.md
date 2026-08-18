# VPS 이사 안내

## 순서 (SSH 접속 후 명령 4개)
```bash
git clone https://github.com/jkryankim-dev/ai-company.git doore && cd doore
bash deploy/setup.sh
nano .env        # PC 의 doore/.env 내용 붙여넣기 (아래 주의)
sudo systemctl start doore
```

## .env 주의
- `APP_REPO=C:\dev\hanoi` 는 Windows 경로다. VPS 에 앱 소스가 없으면 이 줄은 빈 값으로.
  앱 소스도 쓰려면 hanoi 를 GitHub(private) 에 올리고 VPS 에 클론 후 그 경로를 적는다.
- `.env` 는 600 권한 유지 (setup.sh 가 처리).

## git push 권한 (자동 기록용)
```bash
ssh-keygen -t ed25519 -N "" -f ~/.ssh/id_ed25519
cat ~/.ssh/id_ed25519.pub
```
출력된 키를 GitHub 저장소 → Settings → Deploy keys → Add key (Allow write access 체크).
원격을 SSH 로 전환: `git remote set-url origin git@github.com:jkryankim-dev/ai-company.git`

## PC 와의 관계 (중요)
- VPS 가동 후에는 **PC 두레를 꺼둔다**: `stop-doore.bat`. 둘 다 켜면 게이트웨이가 같은 지시에 두 번 답한다.
- 코드를 고치면(어디서든 커밋·푸시) VPS 는 15분 주기 sync 가 자동 pull 한다.
  즉시 반영하려면: `ssh` 후 `cd doore && git pull && sudo systemctl restart doore`
- 회의록·결정도 양방향으로 동기화된다 (sync 가 pull 후 push).

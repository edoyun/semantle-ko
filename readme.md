# 꼬맨틀 — 단어 유사도 추측 게임

수정 내역

원하는 회차 플레이 가능

힌트 - 유사도 범위 내 랜덤으로 힌트 출력

기록 - 진행중 상태일때 힌트 10개, 추측 상위 20개 저장, 회차별 진행 상태 저장

기록 열람 - 설정 옆에 기록 열람 버튼 추가, 기록 내보내기, 가져오기 기능 추가

정답 목록 - 모든 단어 -> 명사로 변경

----

이 레포지터리는 Johannes Gätjen의 [Semantlich](http://semantlich.johannesgaetjen.de/)
([소스코드](https://github.com/gaetjen/semantle-de))를 포크하여,
한국어로 플레이할 수 있도록 수정한 것입니다.

### Setup

Download Word2Vec and dictionary data:
```bash
cd data
wget https://dl.fbaipublicfiles.com/fasttext/vectors-crawl/cc.ko.300.vec.gz
gzip -d cc.ko.300.vec.gz
wget https://github.com/spellcheck-ko/hunspell-dict-ko/releases/download/0.7.92/ko-aff-dic-0.7.92.zip
unzip ko-aff-dic-0.7.92.zip
```

Filter and save word2vec in DB
```bash
docker-compose run --rm --entrypoint python app filter_words.py
docker-compose run --rm --entrypoint python app process_vecs.py
```

(Optional) Regenerate secrets
```bash
docker-compose run --rm --entrypoint python app generate_secrets.py
```

Start server
```bash
docker-compose up
```


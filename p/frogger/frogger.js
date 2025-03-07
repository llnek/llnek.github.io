/* Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Copyright © 2025, Kenneth Leung. All rights reserved. */

;(function(window,UNDEF){

  "use strict";

  //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  const
    int=Math.floor,
    TILE_SHEET="images/items.json";

  //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  function scenes(Mojo){

    const {Sprites:_S,
           Scenes:_Z,
           FX:_F,
           Input:_I,
           Game:_G,
           Ute2D:_U,
           math:_M,
           v2:_V,
           ute:_,is}=Mojo;

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const
      UI_FONT=Mojo.DOKI_LOWER,
      SplashCfg= {
        title:"Frogger",
        clickSnd:"click.mp3",
        action: {name:"PlayGame"}
      };

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    //const doBackDrop=(s)=> 1;//s.insert(_S.fillMax(_S.sprite("bg.png")));
    const playClick=()=> Mojo.sound("click.mp3").play();
    const CLICK_DELAY=343;
    const ICON_WIDTH=64;

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const
      E_PLAYER=1,
      E_CAR=2,
      E_LOG=4,
      E_COIN=8;

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const
      BANDS=["home","water","water","water","grass","road","road","road","grass"].map(x=> `${x}.png`),
      CARS=["bus1","bus2","car1","car2","car3","fire_truck","police","taxi"].map(x=> `${x}.png`),
      BAND_CNT=BANDS.length, ROAD=3, RIVER=3,
      CARGRP={3:[], 4:[], 5:[], 6:[]},
      CARLEN=[4,5,3,3,3,6,4,4],
      CARMAP={};

    CARS.forEach((s,i)=>{
      CARMAP[s]=CARLEN[i];
      CARGRP[CARLEN[i]].push(s);
    });

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const TRACKLEN = 64;
    const TRACKS = [
      [0,    "gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg", "e"],
      [-300, "...4xxx..4xxx....2x...4xxx.....2x...4xxx.....4xxx......4xxx..2x.", "w"],
      [300,  "....xxx4.....xxx4....xxx4.........xxx4.....xxx4.......xxxxx4....","w"],
      [200,  "..xx3.....xx3.....x2.....xx3...xx3....x2....xxx4....x2......x2..", "w"],
      [0,    "dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd", ""],
      [-300, "....5xxxx......4xxx....4xxx........6xxxxx......6xxxxx...5xxxx...", "r"],
      [300,  "....xx3..xxx4..xxx4..xxx4...xxxxx6....xx3.xxxx5......xxx4....xx3", "r"],
      [-400, "..3xx....4xxx.......3xx.5xxxx.....3xx..3xx..3xx...3xx..3xx..3xx.", "r"],
      [0,    "gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg", "s"]
    ];

    ////////////////////////////////////////////////////////////////////////////
    /* */
    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function randStart(){
      let p,out=[];
      TRACKS.forEach((t,i)=>{
        p=-1;
        if(t[0] != 0){
          while(1){
            p=_.randInt2(8,64-8);
            if(t[1].charAt(p)=="."){ break } }
        }
        out[i]=p;
      })
      out.forEach((p,i,t)=>{
        if(p>0){
          t=TRACKS[i];
          t[1]= t[1].substring(p) + t[1].substring(0,p);
        }
        //_.log(TRACKS[i][1]);
      });
    }

    ////////////////////////////////////////////////////////////////////////////
    /* */
    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function mkLog(dir,band,size){
      let
        {tileW,tileH,grid}= _G,
        g=grid[band][0],
        s= _S.spriteFrame(TILE_SHEET,`log${size}.png`);
      s.m5.mask=E_LOG;
      s.height= 0.8 * tileH;
      s.y=_M.ndiv(g.y1+g.y2 - s.height,2);
      s.m5.vel[0]=dir;
      s.m5.tick=(dt)=>{
        _S.move(s,dt);
        dir>0?checkFlowRight(s):checkFlowLeft(s);
      };
      _G.logs[band].push(s);
      return s;
    }

    ////////////////////////////////////////////////////////////////////////////
    /* */
    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function mkCar(dir,band,png){
      let
        {tileW,tileH,grid}= _G,
        g=grid[band][0],
        s= _S.spriteFrame(TILE_SHEET,dir>0?png:`_${png}`);
      s.height= Math.min(s.height,tileH);
      s.y=g.y2-s.height;
      s.m5.type=E_CAR;
      s.m5.vel[0]=dir;
      s.m5.tick=(dt)=>{
        _S.move(s,dt);
        dir>0?checkGoRight(s):checkGoLeft(s);
      };
      return s;
    }

    ////////////////////////////////////////////////////////////////////////////
    /* */
    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function checkFlowRight(s){
      if(s.x>Mojo.width){
        _.assert(s===s.g.river[0], "bad right pop");
        let
          {tileW}=_G,
          e= _.last(s.g.river);
        s.g.river.shift();
        s.g.river.push(s);
        s.x = e.x - s.g.gap*tileW - s.width;
      }
    }

    ////////////////////////////////////////////////////////////////////////////
    /* */
    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function checkFlowLeft(s){
      if((s.x+s.width)<0){
        _.assert(s===s.g.river[0], "bad left pop");
        let
          {tileW}=_G,
          e=_.last(s.g.river);
        s.g.river.shift();
        s.g.river.push(s);
        s.x = e.x + e.width + s.g.gap*tileW;
      }
    }

    ////////////////////////////////////////////////////////////////////////////
    /* */
    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function checkGoRight(s){
      if(s.x>Mojo.width){
        _.assert(s===s.g.track[0], "bad right pop");
        let
          {tileW}=_G,
          e=_.last(s.g.track);
        s.g.track.shift();
        s.g.track.push(s);
        s.x = e.x - s.g.gap*tileW - s.width;
      }
    }

    ////////////////////////////////////////////////////////////////////////////
    /* */
    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function checkGoLeft(s){
      if((s.x+s.width)<0){
        _.assert(s===s.g.track[0], "bad left pop");
        let
          {tileW}=_G,
          e=_.last(s.g.track);
        s.g.track.shift();
        s.g.track.push(s);
        s.x = e.x + e.width + s.g.gap*tileW;
      }
    }

    ////////////////////////////////////////////////////////////////////////////
    /* */
    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function buildTrack(t,band){
      return t[0]>0?buildTrackRight(t,band):buildTrackLeft(t,band)
    }

    ////////////////////////////////////////////////////////////////////////////
    /* */
    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function buildRiver(t,band){
      return t[0]>0?buildRiverRight(t,band):buildRiverLeft(t,band)
    }

    ////////////////////////////////////////////////////////////////////////////
    /* */
    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function buildRiverLeft(t,band){
      let
        {tileW}=_G,
        cells=t[1],
        p,v,gap=0, out=[];
      for(let c,i=0;i<cells.length;++i){
        c=cells.charAt(i);
        if(c=="."){
          gap+=1
        }else if(c=="x"){
        }else{
          let s=mkLog(t[0],band,c);
          s.g.river=out;
          s.g.gap=gap;
          if(!p){
            s.x=tileW*gap;
          }else{
            s.x= p.x+p.width+gap*tileW;
          }
          gap=0;
          p=s;
          out.push(s);
        }
      }
      //since this is like a circular buffer
      //so add remaining gap to the first car
      out[0].g.gap += gap;
      return out;
    }

    ////////////////////////////////////////////////////////////////////////////
    /* */
    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function buildRiverRight(t,band){
      let
        {tileW}=_G,
        p,v,gap=0,
        out=[],cells= t[1];
      for(let c,i=cells.length-1;i>=0;--i){
        c=cells.charAt(i);
        if(c=="."){
          gap+=1
        }else if(c=="x"){
        }else{
          let s=mkLog(t[0],band,c);
          s.g.river=out;
          s.g.gap=gap;
          if(!p){
            s.x= Mojo.width - tileW*gap - s.width;
          }else{
            s.x= p.x- tileW*gap - s.width;
          }
          gap=0;
          p=s;
          out.push(s);
        }
      }
      //since this is like a circular buffer
      //so add remaining gap to the first car
      out[0].g.gap += gap;
      return out;
    }

    ////////////////////////////////////////////////////////////////////////////
    /* */
    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function buildTrackRight(t,band){
      let
        {tileW}=_G,
        p,v,gap=0,
        out=[],cells= t[1];
      for(let c,i=cells.length-1;i>=0;--i){
        c=cells.charAt(i);
        if(c=="."){
          gap+=1
        }else if(c=="x"){
        }else{
          v= _.randItem(CARGRP[c]);
          let s=mkCar(t[0],band,v);
          s.g.track=out;
          s.g.gap=gap;
          if(!p){
            s.x= Mojo.width - tileW*gap - s.width;
          }else{
            s.x= p.x- tileW*gap - s.width;
          }
          gap=0;
          p=s;
          out.push(s);
        }
      }
      //since this is like a circular buffer
      //so add remaining gap to the first car
      out[0].g.gap += gap;
      return out;
    }

    ////////////////////////////////////////////////////////////////////////////
    /* */
    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function buildTrackLeft(t,band){
      let
        {tileW}=_G,
        cells=t[1],
        p,v,gap=0, out=[];
      for(let c,i=0;i<cells.length;++i){
        c=cells.charAt(i);
        if(c=="."){
          gap+=1
        }else if(c=="x"){
        }else{
          v= _.randItem(CARGRP[c]);
          let s=mkCar(t[0],band,v);
          s.g.track=out;
          s.g.gap=gap;
          if(!p){
            s.x=tileW*gap;
          }else{
            s.x= p.x+p.width+gap*tileW;
          }
          gap=0;
          p=s;
          out.push(s);
        }
      }
      //since this is like a circular buffer
      //so add remaining gap to the first car
      out[0].g.gap += gap;
      return out;
    }

    ////////////////////////////////////////////////////////////////////////////
    /* */
    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function fillBand(scene,band,sx,sy,width,height,png){
      let K,s, x=sx, y=sy, row=[];
      function obj(x,y,s){
        return { x1:x,y1:y,x2:x+s.width,y2:y+s.height }
      }
      while(1){
        if((band==0 ||band==BAND_CNT-1) && (x+_G.tileW)>Mojo.width){
          s=_S.sizeXY(_S.sprite("block.png"),_G.tileW, _G.tileH);
        }else{
          s=_S.sizeXY(_S.sprite(png),_G.tileW, _G.tileH);
        }
        scene.insert( _V.set(s,x,y));
        row.push(obj(x,y,s));
        x+=s.width;
        if(x>width){
          row.push(obj(x,y,s));
          break;
        }
      }
      return row;
    }

    ////////////////////////////////////////////////////////////////////////////
    /* */
    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    _Z.scene("PlayGame",{
      setup(){
        let
          self=this,
          K=Mojo.getScaleFactor(),
          W=Mojo.width,H=Mojo.height;
        randStart();
        //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
        _.inject(this.g,{
          initLevel(){
            let sx=0,sy=0,grid=[],
              K,r,h= int(Mojo.height/BAND_CNT);
            _G.tileH=h;
            _G.tileW=h;
            _G.logs=[];
            _G.coins=[];

            BANDS.forEach((b,i)=>{
              r=fillBand(self,i,sx,sy,Mojo.width,h,b);
              grid.push(r);
              sy += h;
            });
            _G.grid=grid;
            //self.insert(_S.drawGridLines(0,0,grid,1,"white"));
          },
          initBands(){
            _G.logs=[];
            TRACKS.forEach((t,i)=>{
              if(t[2]=="r")
                buildTrack(t,i).forEach(s=> self.insert(s,true));
              if(t[2]=="w"){
                _G.logs[i]=[];
                buildRiver(t,i).forEach(s=> self.insert(s,true));
              }
            });
          },
          initHoles(){
            let {tileW,tileH,grid}=_G;
            let s,row=grid[0];
            row.forEach((g,i)=>{
              if(g.x2<Mojo.width){
                if((i%5)==0){
                  g.blocked=true;
                }else{
                  s=_S.sprite("coin.png");
                  s.m5.type=E_COIN;
                  _S.sizeXY(s,tileW*0.5,tileH*0.5);
                  s.x=_M.ndiv(g.x1+g.x2,2);
                  s.y=_M.ndiv(g.y1+g.y2,2);
                  g.blocked=false;
                  _G.coins.push(s);
                  self.insert(_S.centerAnchor(s),true);
                }
              }
            });
          },
          initPlayer(){
            let
              {tileW,tileH,grid}=_G,
              cEnd=grid[0].length-1,
              gEnd=grid.length-1,
              last=grid[gEnd],
              gMid=int(last.length/2)-1,
              m= last[gMid],
              s= _S.sprite("froggy.png");
            _S.centerAnchor(s);
            _S.sizeXY(s,int(0.8*tileW),int(0.8*tileH));
            s.y= _M.ndiv(last[0].y1+last[0].y2,2);
            s.x= _M.ndiv(m.x1+m.x2,2);
            s.m5.type=E_PLAYER;
            s.m5.cmask=E_CAR|E_LOG|E_COIN;
            s.g.row=gEnd;
            s.g.col=gMid;
            s.m5.dispose=()=>{ Mojo.off(s); };
            s.g.reset=()=>{
              s.y= _M.ndiv(last[0].y1+last[0].y2,2);
              s.x= _M.ndiv(m.x1+m.x2,2);
              s.g.row=gEnd;
              s.g.col=gMid;
              s.m5.vel[0]=0;
            };
            s.g.onRiver=(r)=>{
              let hit,row=_G.logs[r];
              for(let o,i=0;i<row.length;++i){
                o=row[i];
                if(_S.hitTest(s,o)){
                  hit=o;
                  break;
                }
              }
              if(!hit){
                s.g.reset();
              }else{
                if(hit===s.g.onLog){
                }else{
                  s.g.onLog=hit;
                  s.m5.vel[0]=hit.m5.vel[0];
                }
              }
            };
            s.m5.tick=(dt)=>{
              if(s.m5.vel[0] != 0){
                _S.move(s,dt);
              }
              if((s.x-s.width/2)<0){
                s.g.reset();
              }else if((s.x+s.width/2)>Mojo.width){
                s.g.reset();
              }
            };
            s.m5.onHit=(col)=>{
              if(col.B.m5.type==E_CAR){
                s.g.reset();
              }else if (col.B.m5.type==E_COIN){
                _.disj(_G.coins,col.B);
                _S.remove(col.B);
                if(_G.coins.length==0){
                  _G.gameOver= self.m5.dead=true;
                  _.delay(CLICK_DELAY,()=>_Z.modal("EndGame",{
                    replay:{name:"PlayGame"},
                    quit:{name:"Splash", cfg:SplashCfg},
                    msg:"You Win!",
                    winner:1
                  }));
                }
              }
            };
            Mojo.on(["hit",s],"onHit",s.m5);
            _G.player=self.insert(s,true);
            /////////
            _G.goLeft=()=>{
              if((s.g.col-1)>=0){
                s.x -= tileW;
                s.g.col-=1;
                if(s.g.row>0&&s.g.row<4){
                  s.g.onRiver(s.g.row);
                }else if(s.g.row==0){
                  if(grid[0][s.g.col].blocked){
                      s.g.col+=1;
                      s.x += tileW;
                    }
                }else{
                  s.m5.vel[0]=0;
                }
              }
            };
            _I.keybd(_I.LEFT,_G.goLeft);
            _G.goRight=()=>{
              if((s.g.col+1)<= cEnd){
                if((s.x+tileW+s.width)<Mojo.width){
                  s.x += tileW;
                  s.g.col+=1;
                  if(s.g.row>0&&s.g.row<4){
                    s.g.onRiver(s.g.row);
                  }else if(s.g.row==0){
                    if(grid[0][s.g.col].blocked){
                      s.g.col-=1;
                      s.x -= tileW;
                    }
                  }else{
                    s.m5.vel[0]=0;
                  }
                }
              }
            };
            _I.keybd(_I.RIGHT,_G.goRight);
            _G.goUp=()=>{
              if((s.g.row-1)>=0){
                s.y -= tileH;
                s.g.row-=1;
                if(s.g.row>0&&s.g.row<4){
                  s.g.onRiver(s.g.row);
                }else{
                  if(s.g.row==0){
                    s.g.col= int(s.x/tileW);
                    if(grid[0][s.g.col].blocked){
                      s.g.row+=1;
                      s.y += tileH;
                    }else{
                      s.x= int(s.g.col*tileW + s.width/2);
                      s.m5.vel[0]=0;
                      s.g.onLog=null;
                    }
                  }else{
                    s.m5.vel[0]=0;
                  }
                }
              }
            };
            _I.keybd(_I.UP,_G.goUp);
            _G.goDown=()=>{
              if((s.g.row+1)<=gEnd){
                s.y += tileH;
                s.g.row+=1;
                if(s.g.row>0&&s.g.row<4){
                  s.g.onRiver(s.g.row);
                }else{
                  s.m5.vel[0]=0;
                  s.g.onLog=null;
                  if(s.g.row==4){
                    s.g.col= int(s.x/tileW);
                    s.x= int(s.g.col*tileW + s.width/2);
                  }
                }
              }
            };
            _I.keybd(_I.DOWN,_G.goDown);
          }
        });
        //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
        this.g.initLevel();
        this.g.initBands();
        this.g.initHoles();
        this.g.initPlayer();
        _Z.run("HotKeys",{
          buttons:true,
          cb(obj){
            obj.up.m5.press=()=> _G.goUp();
            obj.down.m5.press=()=> _G.goDown();
            obj.left.m5.press=()=> _G.goLeft();
            obj.right.m5.press=()=> _G.goRight();
            return obj;
          }
        });
      },
      postUpdate(dt){
        this.searchSGrid(_G.player).forEach(o=>{
          _S.hit(_G.player,o);
        });
      }
    });

    _Z.run("Splash", SplashCfg);
  }

  //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  //load and run
  MojoH5Ldr({
    assetFiles: ["click.mp3","game_over.mp3","game_win.mp3",
                 "home.png","coin.png","block.png","road.png",
                 "grass.png","water.png","dirt.png","bush.png",
                 "coin.png","froggy.png",TILE_SHEET],
    arena: {width: 1344, height: 840},
    scaleToWindow:"max",
    //scaleFit:"x",
    start(...args){ scenes(...args) }
  });

})(this);



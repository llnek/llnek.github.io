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
  const int=Math.floor;
  const sin=Math.sin;
  const cos=Math.cos;
  const PI2= Math.PI*2;

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

    ////////////////////////////////////////////////////////////////////////////
    const GA= window["io/czlab/mcfud/algo/NEAT"]();
    const Core= window["io/czlab/mcfud/core"]();

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const
      UI_FONT=Mojo.DOKI_LOWER,
      SplashCfg= {
        title:"NEAT/Flappy Bird",
        clickSnd:"click.mp3",
        action: {name:"PlayGame"}
      };

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const playClick=()=> Mojo.sound("click.mp3").play();
    const CLICK_DELAY=343;
    const SPAWN_TIME= 90;

    const FLAP_VALUE= 0.65;

    const INPUTS=4;
    const OUTPUTS=1;
    const POPSIZE=50;

    ////////////////////////////////////////////////////////////////////////////
    /* */
    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function Pipes(K,[x1,y1,h1],[x2,y2,h2]){
      let
        st= _S.sprite("pipetop.png"),
        sb= _S.sprite("pipebottom.png");
      _S.scaleXY(st,K,2);
      _S.scaleXY(sb,K,2);
      st.x=x1;
      st.y=h1-st.height;
      sb.x=x2;
      sb.y=y2;
      st.g.passed=false;
      sb.g.passed=false;
      st.m5.speed=3*K;
      sb.m5.speed= st.m5.speed;

      let c=_.randItem(["red","green","blue","orange", "purple"]);
      c="magenta";
      _S.tint(st, c);
      _S.tint(sb, c);
      return [st,sb];
    }

    ////////////////////////////////////////////////////////////////////////////
    /* */
    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function Bird(self,K,g){
      let s= _S.sprite("bird.png");
      _S.centerAnchor(s);
      _S.scaleXY(s,K,K);
      s.x = Mojo.width/3;
      s.y = Mojo.height/2;
      s.m5.gravity = 0;
      s.m5.speed = 0.5;
      s.m5.jump = -6;
      s.g.brain=g;
      s.g.score=0;
      s.g.flap=()=>{
        s.m5.gravity = s.m5.jump
      };
      s.g.update=()=>{
        s.m5.gravity += s.m5.speed;
        s.y += s.m5.gravity;
      };
      s.g.isDead=(height, pipes)=>{
        if(s.y >= height || s.y + s.height <= 0){ return true }
        for(let i=0;i<pipes.length;++i){
          if(!( s.x > pipes[i].x + pipes[i].width ||
                s.x + s.width < pipes[i].x ||
                s.y > pipes[i].y + pipes[i].height ||
                s.y + s.height < pipes[i].y)){
            return true
          }
        }
      };
      s.g.think=(inputs)=>{
        if(inputs && s.g.brain.compute(inputs)[0] > FLAP_VALUE){
          s.g.flap();
        }
        return s.g;
      };
      s.g.look=(pipes)=>{
        for(let p1,p2,i=0; i<pipes.length; i+=2){
          p1=pipes[i];
          p2=pipes[i+1];
          if(p1.x+p1.width> s.x){
            return [
              _M.remap((p2.y - (p2.y-(p1.y+p1.height))/2)-s.y,0,Mojo.height,0,1),
                    _M.remap(p1.x-s.x, 0, Mojo.width, 0,1),
                    _M.remap(Math.max(0, p2.y - s.y), 0, Mojo.height, 0, 1),
                    _M.remap(Math.max(0, s.y - p1.y+p1.height), 0, Mojo.height, 0, 1)
            ];
          }
          if(s.x >= p1.x+p1.width){
            p1.g.passed=true;
            p2.g.passed=true;
            s.g.score += 30;
          }
        }
      };
      return self.insert(s);
    }

    ////////////////////////////////////////////////////////////////////////////
    /* */
    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    _Z.scene("PlayGame",{
      setup(){
        let
          self=this,
          K=Mojo.getScaleFactor();
        //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
        _.inject(this.g,{
          initLevel(){
            this.bgs=_.fill(2, ()=> _S.sprite("background.png"));
            this.spawnInterval = SPAWN_TIME;
            this.NeatModule="CBullet";
            this.bgs.forEach(s=>{
              _S.scaleToCanvas(self.insert(s))
            });
            this.pipes = [];
            this.birds = [];
            this.interval = 0;
            this.waitNextWave=0;
            this.pipesPassed=0;
            this.bestCurScore=0;
            this.bgSpeed = 0.5;
            this.bgX = 0;
            this.swapEngine();
          },
          swapEngine(){
            this.neatObj= new GA.NeatGA(POPSIZE, INPUTS, OUTPUTS);
            this.birds.forEach(b=> _S.remove(b));
            this.birds= this.neatObj.createPhenotypes().map(g=> new Bird(self,K,g));
            this.resetNext(true);
          },
          tick(dt){
            this.bgX += this.bgSpeed;
            if(this.waitNextWave>0){
              --this.waitNextWave;
            }else{
              this.doMoreTick(dt);
            }
          },
          doMoreTick(dt){
            this.bestCurScore=0;
            this.birds.forEach((b,i)=>{
              if(b.m5.dead){
                b.visible=false;
              }else{
                b.g.think( b.g.look(this.pipes)).update();
                if(b.g.isDead(Mojo.height, this.pipes)){
                  b.m5.dead=true;
                }else{
                  b.rotation= Math.PI/2 * b.m5.gravity/20;
                  b.g.score +=1;
                }
                if(b.g.score>this.bestCurScore){
                  this.bestCurScore=b.g.score;
                }
              }
            });
            this.isItEnd() ? this.resetNext() : this.checkPipes().morePipes()
          },
          resetNext(skip){
            this.pipes.forEach(s=> _S.remove(s));
            this.waitNextWave=30;
            this.pipesPassed=0;
            this.bestCurScore=0;
            this.interval = 0;
            _.trunc(this.pipes);
            if(!skip){
              this.neatObj.epoch(this.birds.reduce((acc,s)=>{
                return acc.push(s.g.score) && _S.remove(s) && acc
              }, []));
              this.birds= this.neatObj.createPhenotypes().map(g=> new Bird(self,K,g));
            }
          },
          checkPipes(){
            let tmp=[];
            for(let p1,p2,i=0; i<this.pipes.length; i += 2){
              p2=this.pipes[i+1];
              p1=this.pipes[i];
              p1.x -= p1.m5.speed;
              p2.x=p1.x;
              if(p1.g.passed){
                if(!p1.g.dead){
                  this.pipesPassed+=1;
                  p1.g.dead=true;
                  p2.g.dead=true;
                }
              }
              if(p1.x+p1.width < 0){
                _S.remove(p1,p2);
              }else{
                tmp.push(p1,p2);
              }
            }
            if(tmp.length<this.pipes.length){
              _.append(this.pipes,tmp,true)
            }
            return this;
          },
          isItEnd(){
            return this.birds.every(b=> b.m5.dead)
          },
          morePipes(){
            if(this.interval == 0){
              let delta= 50*K,
                  pipeGap = 120*K,
                  topHeight= Math.round(_.rand() * (Mojo.height - delta* 2 - pipeGap)) +  delta;
              Pipes(K,[Mojo.width, 0, topHeight],
                      [Mojo.width, topHeight+pipeGap, Mojo.height]).forEach(s=> this.pipes.push(self.insert(s)));
            }
            if(++this.interval >= this.spawnInterval){
              this.interval = 0
            }
            return this;
          }
        });
        //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
        this.g.initLevel();
        this.g.genText=_S.bmpText("",UI_FONT,12*K);
        this.insert(this.g.genText);
        this.g.menu= _S.sprite("menu.png");
        _S.scaleBy(this.g.menu, 0.6*K,0.6*K);
        this.g.menu.anchor.x=1;
        this.g.menu.m5.press=()=>{
          _.delay(0,()=> _Z.runEx("Splash",SplashCfg))
        };
        _V.set(this.g.menu, Mojo.width,0);
        this.insert(_I.mkBtn(this.g.menu));
      },
      postUpdate(dt){
        if(_I.keyDown(_I.TAB)){
        }else{
          this.g.bgs.forEach((s,i)=>{
            s.x= i * s.width - int(this.g.bgX % s.width);
            s.y=0;
          });
          this.g.tick();
          this.g.genText.text= `Generation: ${this.g.neatObj.curGen()} - Pipes: ${this.g.pipesPassed} Score: ${this.g.bestCurScore}`;
        }
      }
    });

    _Z.run("Splash", SplashCfg);
  }

  //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  //load and run
  MojoH5Ldr({
    assetFiles: ["bird.png","pipetop.png","pipebottom.png",
                 "menu.png","background.png","click.mp3"],
    arena: {width: 1024, height: 720},
    scaleToWindow:"max",
    start(...args){ scenes(...args) }
  });

})(this);



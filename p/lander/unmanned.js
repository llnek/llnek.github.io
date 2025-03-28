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
           v2:_V,
           math:_M,
           ute:_,is}=Mojo;

    ////////////////////////////////////////////////////////////////////////////
    const Core= window["io/czlab/mcfud/core"]();

    ////////////////////////////////////////////////////////////////////////////
    const NEAT_MODULES={
      "Buckland": {
        eng: window["io/czlab/mcfud/algo/NEAT_Buckland"](Core,_M),
        id: "MB"
      },
      "CBullet": {
        eng: window["io/czlab/mcfud/algo/NEAT_CBullet"](Core, _M),
        id: "CB"
      }
    };

    ////////////////////////////////////////////////////////////////////////////
    const CONST_ONE_DEGREE = Math.PI / 180;   // 1 degree in radians
    const TWO_PI=Math.PI * 2;
    const ANGLE_LIMIT = 0.1;  // About 6 degrees
    const SPEED_LIMIT = 10;//2;    // 2 m/s  ( Apollo 17 landed ~ 6.7 feet/s velocity )

    const GRAVITY=  1/100;//1/60;//1.63/60;
    const THRUST=  -2;// -10;
    const ROTATION= 3.0 / 60;
    const MASS= 100;

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const
      UI_FONT=Mojo.DOKI_LOWER,
      SplashCfg= {
        title:"Moon Lander",
        clickSnd:"click.mp3",
        action: {name:"PlayGame"}
      };

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const playClick=()=> Mojo.sound("click.mp3").play();
    const CLICK_DELAY=343;

    const OBJ_SHIP=1;
    const OBJ_HILL=2;
    const OBJ_GROUND=4;
    const OBJ_SITE=8;

    const SPAWN_TIME= 90;
    const INPUTS=2;
    const OUTPUTS=3;
    const POPSIZE=50;

    ////////////////////////////////////////////////////////////////////////////
    function Terrain(self,K,out){
      let maxH=int(Mojo.height*0.4);
      let minH= int(maxH*0.25);
      let hoffset=10*K;
      let s,pad=4,N=10;
      let w=Mojo.width/N;
      let vcolor=_S.color("#906908");
      let pcolor=_S.color("#cbcb02");
      let T=[0.1,0.24,0.24,0.24,0.24,0.24,0.35,0.35,0.35,0.35];
      let V=[0,0,0.2,0.5,0,0.7,0.7,1.2,1.2,0];
      _.assert(V.length==T.length && T.length==N,"bad terrain");
      for(let h, i=0;i<N;++i){
        h=T[i]* maxH;
        s=_S.rect(w,h,vcolor,vcolor);
        s.m5.type=OBJ_GROUND;
        _S.uuid(s,`ground#${i}`);
        s.x=w*i;
        s.y=Mojo.height-hoffset-s.height;
        out.push(T[i]=self.insert(s,true));
      }
      for(let dx,dy,z,x,h, i=0;i<N;++i){
        h=V[i]* maxH;
        z=0;
        dy=0;
        dx=0;
        if(h>0){
          x=w*i;
          if((i+1<N) && V[i]==V[i+1]){
            z=w;
          }/*
          if(T[i].height>T[i-1].height){
            dy=T[i].height-T[i-1].height;
            dx= -dy;
          }*/
          s=_S.triangle(w+z,h,0.5,vcolor,vcolor);
          s.m5.type=OBJ_HILL;
          _S.uuid(s,`hill#${i}`);
          s.x=x+dx;
          s.y=Mojo.height-hoffset-s.height-T[i].height + dy;
          out.push(self.insert(s,true));
          if(z>0)i++;
        }
      }
      let gc=_S.color("#739b08");
      let g=_S.rect(Mojo.width,hoffset,gc,gc);
      g.y=Mojo.height-g.height;
      self.insert(g);
      /////
      let ps=_S.rect(T[pad].width/2,10,pcolor,pcolor);
      _S.uuid(ps,"landing_pad");
      ps.m5.type=OBJ_SITE;
      _S.centerAnchor(ps);
      ps.x=T[pad].x+T[pad].width/2;
      ps.y=T[pad].y-ps.height/2;
      out.push(self.insert(ps,true));
      _.inject(_G,{
        obstacles:out,
        target:ps
      });
    }

    ////////////////////////////////////////////////////////////////////////////
    /* */
    function Ship(self,K,g){
      let w= _S.sprite("lander.png").height,
          s=_S.sprite(_S.frames("lander.png",w,w)),
          k= 0.6*_G.target.width/s.width;
      _S.centerAnchor(_S.scaleBy(s,k,k));
      s.m5.vel[0]=0;//_.randSign()*20;
      s.m5.mass=MASS;
      s.m5.type=OBJ_SHIP;
      s.m5.cmask=OBJ_HILL | OBJ_GROUND | OBJ_SITE;
      s.g.brain=g;
      s.g.score=0;
      s.g.tick=0;
      s.g.landed=false;
      s.g.update=(dt)=>{
        s.m5.vel[1] += GRAVITY;
        s.x += s.m5.vel[0];
        s.y += s.m5.vel[1];
        s.g.tick+=1;
        return s.g;
      };
      s.g.think=(inputs,dt)=>{
        let out=s.g.brain.compute(inputs);
        if(out[0] > 0.5){
          s.rotation -= CONST_ONE_DEGREE;
          if(s.rotation< -Math.PI){ s.rotation += TWO_PI; }
        }
        if(out[1] > 0.5){
          s.rotation += CONST_ONE_DEGREE;
          if(s.rotation> TWO_PI){ s.rotation -= TWO_PI; }
        }
        if(out[2] > 0.5){
          let accel = THRUST / s.m5.mass;
          s.m5.vel[0] -= accel * Math.sin(s.rotation);
          s.m5.vel[1] += accel * Math.cos(s.rotation);
        }
        return s.g;
      };
      s.g.look=()=>{
        let dx=_G.target.x - s.x;
        let dy= _G.target.y - s.y;
        s.g.score += (5000 * 1/Math.abs(dx));
        s.g.score += (3000 * 1/Math.abs(dy));
        s.g.score += 1/(1+Math.abs(s.rotation));
        s.g.score += s.g.tick;
        return[
          _M.remap(Math.max(0,dx), 0,Mojo.width, 0,1),
          _M.remap(Math.max(0,dy), 0, Mojo.height, 0, 1)
        ];
      };
      s.g.isDead=()=>{
        if(s.x < 0 || s.x > Mojo.width || s.y < 0 || s.y > Mojo.height){
          s.m5.dead=true;
        }else{
          _G.obstacles.find(o=>{
            if(_S.hit(o,s)){
              s.m5.dead=true;
              if(o.m5.uuid=="landing_pad"){
                let v = s.m5.vel[0] + s.m5.vel[1];
                let ang = Math.abs(s.rotation);
                if(v < SPEED_LIMIT && ang < ANGLE_LIMIT){
                  s.g.landed=true;
                  _G.winner= ok = s;
                  console.log("YEah!!!!");
                }
              }
              return true;
            }
          });
        }
        if(s.m5.dead) console.log("shit!!!!");
        return s.m5.dead;
      };
      s.x=Mojo.width*0.3;
      s.y=s.height/2;
      return self.insert(s,true);
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    _Z.scene("PlayGame",{
      setup(){
        const self=this,
              K=Mojo.getScaleFactor();
        //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
        _.inject(this.g,{
          initTerrain(){
            Terrain(self,K,[])
          },
          isItEnd(){
            return _G.winner || this.ships.every(b=> b.m5.dead)
          },
          initLevel(){
            this.spawnInterval = SPAWN_TIME;
            this.NeatModule="Buckland";
            this.waitNextWave=0;
            this.bestCurScore=0;
            this.ships=[];
            this.swapEngine(this.NeatModule);
          },
          swapEngine(e){
            this.NeatModule=e;
            this.Neat= NEAT_MODULES[this.NeatModule];
            this.neatObj= new this.Neat.eng.NeatGA(POPSIZE, INPUTS, OUTPUTS);
            this.ships.forEach(b=> _S.remove(b));
            this.ships= this.neatObj.createPhenotypes().map(g=> new Ship(self,K,g));
            this.resetNext(true);
          },
          resetNext(skip){
            this.waitNextWave=30;
            this.bestCurScore=0;
            if(!skip){
              this.ships = this.neatObj.epoch(this.ships.reduce((acc,s)=>{
                return acc.push(s.g.score) && _S.remove(s) && acc
              }, [])).map(g=> new Ship(self,K,g));
            }
          },
          tick(dt){
            if(this.waitNextWave>0){
              --this.waitNextWave;
            }else{
              this.doMoreTick(dt);
            }
          },
          doMoreTick(dt){
            this.bestCurScore=0;
            for(let b,i=0;i<this.ships.length;++i){
              b=this.ships[i];
              if(b.m5.dead){
                b.visible=false;
              }else{
                b.g.think( b.g.look(),dt).update(dt).isDead();
                if(b.g.score>this.bestCurScore){
                  this.bestCurScore=b.g.score;
                }
              }
              if(_G.winner){
                break;
              }
            }
            this.isItEnd() ? this.resetNext() : 0;
          }
        });
        function cb(){
          if(_I.keyDown(_I.SPACE)||_I.keyDown(_I.UP)){
            _G.player.m5.showFrame(1);
          }else{
            _G.player.m5.showFrame(0);
          }
          self.future(cb,500);
        }
        //self.future(cb,500);
        //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
        _Z.run("StarfieldBg",{static:true});
        this.g.initTerrain();
        this.g.initLevel();
        this.g.genText=_S.bmpText("",UI_FONT,12*K);
        this.insert(this.g.genText);
      },
      dispose(){
      },
      postUpdate(dt){
        this.g.tick(dt);
        this.g.genText.text= `Generation(${this.g.Neat.id}): ${this.g.neatObj.curGen()} - Score: ${this.g.bestCurScore}`;
      }
    });

    _Z.run("Splash", SplashCfg);
  }

  //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  //load and run
  MojoH5Ldr({
    assetFiles: ["lander.png","click.mp3","fire.mp3",
                 "explosion.mp3","game_over.mp3","game_win.mp3"],
    arena: {width: 1344, height: 840},
    scaleToWindow:"max",
    //scaleFit:"x",
    start(...args){ scenes(...args) }
  });

})(this);



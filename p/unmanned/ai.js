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
    const GA= window["io/czlab/mcfud/algo/NNetGA"](Core);

    const Params=GA.config({
      //mutationRate: 0.01
    });

    ////////////////////////////////////////////////////////////////////////////

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const
      UI_FONT=Mojo.DOKI_LOWER,
      SplashCfg= {
        title:"Unmanned Lander",
        clickSnd:"click.mp3",
        action: {name:"PlayGame"}
      };

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const playClick=()=> Mojo.sound("click.mp3").play();
    const CLICK_DELAY=343;

    const SPAWN_TIME= 90;

    const OBJ_SHIP=1;
    const OBJ_HILL=2;
    const OBJ_GROUND=4;
    const OBJ_SITE=8;

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const CONST_ONE_DEGREE = Math.PI / 180;   // 1 degree in radians
    const TWO_PI=Math.PI * 2;
    const ANGLE_LIMIT = 0.1;  // About 6 degrees
    const SPEED_LIMIT = 10;//2;    // 2 m/s  ( Apollo 17 landed ~ 6.7 feet/s velocity )
    const GRAVITY=  1/150;//1/100;//1/60;//1.63/60;
    const THRUST=  -4;//-2;// -10; 350
    const ROTATION= 3.0 / 60;
    const MASS= 100;

    const ROT_L=1, ROT_R=2, FIRE_THRUST=3, FFALL= 4;
    const ACTIONS=[ROT_L, ROT_R, FIRE_THRUST, FFALL];

    const MAX_ACTION_COUNT = 30;
    const BIG_NUMBER=9999999;

    const GRAVITY_PER_TICK=      GRAVITY;
    const THRUST_PER_TICK=       THRUST;
    const ROTATION_PER_TICK=     ROTATION;

    const ROTATION_TOLERANCE=     Math.PI/16;
    const SPEED_TOLERANCE=        0.5;
    const DIST_TOLERANCE=         10.0;

    const POPSIZE=              100;
    const CHROMO_LENGTH=         30;

    const MAX_GENERATIONS_ALLOWED= 500;

    const MAX_MUTATE_COUNT = MAX_ACTION_COUNT/2;

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    class Gene{
      constructor(action,count){
        this.action = action || _.randItem(ACTIONS);
        this.count = count || _.randInt2(1, MAX_ACTION_COUNT);
      }
      eq(other){
        return this.action==other.action && this.count == other.count;
      }
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    class Chromo extends GA.ChromoNumero {
      constructor(numActions,calc,target){
        super((function(){
          return _.fill(numActions, ()=> new Gene())
        }()), calc, target);
      }
      clone(){
				let [f,t]= this.getScoreCalcInfo();
				return new Chromo(this.copyGenes(), f, t);
			}
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function create(arg){
      function calcFit(){ return 0 }
      return arg ? new Chromo(arg,calcFit) :
                   new Chromo(CHROMO_LENGTH, calcFit);
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function mutate(genes){
      genes.forEach(g=>{
        if(_.rand() < Params.mutationRate)
          g.action = _.randItem(ACTIONS);
        if(_.rand() < Params.mutationRate/2){
          g.count = _M.clamp(0, MAX_MUTATE_COUNT, g.count + _.randMinus1To1()*MAX_MUTATE_COUNT);
        }
      })
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function crossOver(mum, dad){
      let b1,b2;
      if(_.rand() > Params.crossOverRate || mum === dad){
        b1 = mum.copyGenes();
        b2 = dad.copyGenes();
      }else{
        let swap= _.rand() * mum.size();
        b1=[];
        b2=[];
        for(let i=0; i < mum.size(); ++i){
          if(_.rand()<swap){
            b1.push(dad[i]);
            b2.push(mum[i]);
          }else{
            b1.push(mum.getGeneAt(i));
            b2.push(dad.getGeneAt(i));
          }
        }
      }
      return [b1,b2];
    }

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

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function checkLanding(s,dist,speed){
      if(dist< DIST_TOLERANCE &&
         speed < SPEED_TOLERANCE &&
         Math.abs(rotation) < ROTATION_TOLERANCE){
        s.g.score= BIG_NUMBER;
        s.g.landed=true;
        _G.winner=s;
      }
      return s.g.landed;
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function calcScore(s){
      let distFromPad = Math.abs(_G.target.x - s.x);
      let distFit = Mojo.width - distFromPad;
      let speed = Math.sqrt(s.m5.vel[0]*s.m5.vel[0]+s.m5.vel[1]*s.m5.vel[1]);
      let rotFit = 1/(Math.abs(s.rotation)+1);
      let fitAirTime = s.g.tickCount/(speed+1);
      if(!checkLanding(s,distFromPad,speed)){
        s.g.score= distFit + 400*rotFit + 4* fitAirTime;
      }
      return s.g.score;
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function testForImpact(s){
      _G.obstacles.find(o=>{
        if(_S.hit(o,s)){
          s.m5.dead=true;
          if(o.m5.uuid=="landing_pad"){
            checkLanding(s,
                         Math.abs(_G.target.x - s.x),
                         Math.sqrt(s.m5.vel[0]*s.m5.vel[0]+s.m5.vel[1]*s.m5.vel[1]));
          }
          return true;
        }
      });
      return s.m5.dead;
    }

    ////////////////////////////////////////////////////////////////////////////
    /**/
    function Ship(self,K,g){
      let w= _S.sprite("unmanned.png").height,
          s=_S.sprite(_S.frames("unmanned.png",w,w)),
          k= 0.6*_G.target.width/s.width;
      _S.centerAnchor(_S.scaleBy(s,k,k));
      s.rotation= 0;//Math.PI;
      s.m5.vel[0]=0;
      s.m5.vel[1]=0;
      s.m5.mass=MASS;
      s.m5.type=OBJ_SHIP;
      s.m5.cmask=OBJ_HILL | OBJ_GROUND | OBJ_SITE;
      s.g.actions=[];
      s.g.brain=g;
      s.g.score=0;
      s.g.tickCount=0;
      s.g.landed=false;
      g.iterGenes((a)=>{
        for(let i=0;i<a.count;++i) s.g.actions.push(a.action);
      });
      s.g.update=function(dt){
        let next;
        if(this.landed){ return false; }
        if(this.tickCount >= this.actions.length){
          next=FFALL;
        }else{
          next=this.actions[this.tickCount++];
        }
        s.m5.vel[1] += GRAVITY;
        s.x += s.m5.vel[0];
        s.y += s.m5.vel[1];
        this.tickCount += 1;
        this.showJet = false;
        switch(next){
          case ROT_L:
            s.rotation -= ROTATION_PER_TICK;
            if(s.rotation < -Math.PI){
              s.rotation += TWO_PI;
            }
            s.m5.showFrame(0);
            break;
          case ROT_R:
            s.rotation += ROTATION_PER_TICK;
            if(s.rotation > TWO_PI){
              s.rotation -= TWO_PI;
            }
            s.m5.showFrame(0);
            break;
          case FIRE_THRUST:
            let a = THRUST_PER_TICK/s.m5.mass;
            s.m5.vel[0] += a * sin(s.rotation);
            s.m5.vel[1] += a * cos(s.rotation);
            this.showJet = true;
            s.m5.showFrame(1);
            break;
          default:
            s.m5.showFrame(0);
            break;
        }
        s.m5.vel[1] += GRAVITY_PER_TICK;
        s.x += s.m5.vel[0];
        s.y += s.m5.vel[1];
        if(s.x > Mojo.width){ s.x = 0 }
        if(s.x < 0){ s.x = Mojo.width }
        if(testForImpact(s) && !this.landed){
          calcScore(s);
        }
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
            this.waitNextWave=0;
            this.bestCurScore=0;
            this.ships=[];
            this.swapEngine();
          },
          swapEngine(){
            this.neatObj= new GA.NeuralGA(POPSIZE, {create, mutate, crossOver});
            this.ships.forEach(b=> _S.remove(b));
            this.ships= this.neatObj.createPhenotypes().map(g=> Ship(self,K,g));
            this.resetNext(true);
          },
          resetNext(skip){
            this.waitNextWave=30;
            this.bestCurScore=0;
            if(!skip){
              this.ships = this.neatObj.epoch(this.ships.reduce((acc,s)=>{
                return acc.push(s.g.score) && _S.remove(s) && acc
              }, [])).map(g=> Ship(self,K,g));
            }
          },
          tick(dt){
            if(this.waitNextWave>0){
              --this.waitNextWave;
            }else if(!_G.winner){
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
                b.g.update(dt);
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
        this.g.genText.text= `Generation: ${this.g.neatObj.curGen()} - Score: ${this.g.bestCurScore}`;
      }
    });

    _Z.run("Splash", SplashCfg);
  }

  //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  //load and run
  MojoH5Ldr({
    assetFiles: ["unmanned.png","click.mp3","fire.mp3",
                 "explosion.mp3","game_over.mp3","game_win.mp3"],
    arena: {width: 1344, height: 840},
    scaleToWindow:"max",
    //scaleFit:"x",
    start(...args){ scenes(...args) }
  });

})(this);



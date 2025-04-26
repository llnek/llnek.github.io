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
    const GA= window["io/czlab/mcfud/algo/ChromoGA"]();
    const NN= window["io/czlab/mcfud/algo/NNet"]();
    const Core= window["io/czlab/mcfud/core"]();

    const Params=GA.config({
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

    const FUEL_WEIGHT = 0.05;
    const SPEED_WEIGHT = -4;
    const ANGLE_DIFF_WEIGHT = 8;
    const TARGET_WEIGHT = -0.15;
    const LANDING_SCORE = 500;

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const TWO_PI=Math.PI * 2;
    const GRAVITY= 0.1;
    const THRUST=  1/2000;
    const MAX_ROTATION = Math.PI / 2;

    const ROCKET_SPAWN_ROT = Math.PI / 3;
    const ROCKET_SPAWN_VEL_X = 2;
    const ROCKET_SPAWN_VEL_Y = 0;
    const ANGULAR_SPEED = 1 / 4;
    const MAX_ROCKET_LIFETIME = 25 * 1000; // 20 seconds

    const ROCKET_MASS_RATIO=0.2;
    const BIG_NUMBER=9999999;

    const THRUST_MASS_FACTOR =1/2000;

    const ROTATION_TOLERANCE=     Math.PI/16;
    const SPEED_TOLERANCE=        0.5;
    const DIST_TOLERANCE=         10.0;

    const MAX_ROCKET_FORCE = 10;
    const MAX_ROCKET_FUEL = 500;
    const ROCKET_FUEL_DECR = 1.2;
    const ROCKET_FORCE_INC = 0.3;

    const ROCKET_LANDING_EPSILON=0;
    const SPEED_EPSILON= 0.3;

    const POPSIZE=30;

    const INPUTS=3;
    const OUTPUTS=4;

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
    function XXXcalcScore(s){
      let dx= Math.abs(_G.target.x-s.x);
      let dy= Math.abs(_G.target.y-s.y);
      let distX = Mojo.width/(1+dx);
      let distY = Mojo.height/(1+dy);
      let speed = Math.sqrt(s.m5.vel[0]*s.m5.vel[0]+s.m5.vel[1]*s.m5.vel[1]);
      let fitAirTime = s.g.tickCount/(speed+1);
      let rotFit = Math.abs(Math.PI/4 - s.rotation);
      let speedFit= Math.abs(3*GRAVITY - speed);
      let dist =Math.sqrt(dx*dx+dy*dy);
      if(!checkLanding(s,dx,speed)){
        s.g.score= 1000* distX + 1000* distY + 4 * fitAirTime - 500 * rotFit - 1000*speedFit;
        if(dist<100 && speed<2*GRAVITY){
          s.g.score += 5000;
        }
      }
      return s.g.score;
    }

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    function testForImpact(s){
      _G.obstacles.find(o=>{
        if(_S.hit(o,s)){
          s.m5.dead=true;
          s.g.score= -1500;
          if(o.m5.uuid=="landing_pad"){
            checkLanding(s,
                         Math.abs(_G.target.x - s.x),
                         Math.sqrt(s.m5.vel[0]*s.m5.vel[0]+s.m5.vel[1]*s.m5.vel[1]));
            if(!s.g.landed) s.g.score=888;

          }
          return true;
        }
      });
      return s.m5.dead;
    }

    function argMax(arr){
      let max= -Infinity, pos= -1;
      arr.forEach((v,i)=>{
        if(v>max){
          max=v;pos=i;
        }
      });
      return [pos, max];
    }
    ////////////////////////////////////////////////////////////////////////////
    /**/
    function Ship(self,K,g){
      let w= _S.sprite("unmanned.png").height,
          s=_S.sprite(_S.frames("unmanned.png",w,w)),
          k= 0.6*_G.target.width/s.width;
      _S.centerAnchor(_S.scaleBy(s,k,k));
      s.m5.mass= s.width * s.height * ROCKET_MASS_RATIO;
      s.m5.type=OBJ_SHIP;
      s.m5.cmask=OBJ_HILL | OBJ_GROUND | OBJ_SITE;

      s.rotation=ROCKET_SPAWN_ROT;
      s.m5.vel[0]=2;
      s.m5.vel[1]=GRAVITY;

      s.g.brain=g.getGeneAt(0);
      s.g.score=0;
      s.g.tickCount=0;
      s.g.landed=false;
      s.g.fresh= true;
      s.g.force= 0;
      s.g.fuel= MAX_ROCKET_FUEL;
      s.g.lastSpeed= 0;
      s.g.born=performance.now();
      s.g.lifetime= 0;
      s.g.hasThrusted= false;
      s.g.calcSpeed=function(){
        return Math.sqrt(s.m5.vel[0]*s.m5.vel[0]+s.m5.vel[1]*s.m5.vel[1]);
      };
      s.g.update=function(dt){
        let dx= this.lastPos[0] - s.x, dy= this.lastPos[1] - s.y;
        let d=Math.sqrt(dx*dx+dy*dy);
        let v= this.calcSpeed();
        if(!this.fresh && d <= ROCKET_LANDING_EPSILON && v <= SPEED_EPSILON){
          this.onTarget();
        }
        this.hasThrusted=false;
        if(!this.hasThrusted){
          this.force = _M.clamp( this.force - 1.2 ** ROCKET_FORCE_INC, 0, MAX_ROCKET_FORCE);
        }
        this.lastSpeed = v;
        this.lifetime += dt;
        this.fresh = false;
        if(this.lifetime > MAX_ROCKET_LIFETIME){
          s.m5.dead=true;
        }
        this.think();
        s.x += s.m5.vel[0];
        s.y += s.m5.vel[1] + GRAVITY;
        this.calcScore();
      };
      s.g.thrust=function(){
        if(this.fuel <= 0) return;
        let f = s.m5.mass * THRUST_MASS_FACTOR;
        s.m5.vel[0] += f * Math.cos(s.rotation);//- Math.PI / 2);
        s.m5.vel[1] += f * Math.sin(s.rotation);//- Math.PI / 2);
        this.force = _M.clamp( this.force + ROCKET_FORCE_INC, 0, MAX_ROCKET_FORCE);
        this.fuel = _M.clamp( this.fuel - ROCKET_FUEL_DECR, 0, MAX_ROCKET_FUEL);
        this.hasThrusted = true;
      };
      s.g.rotl =function(){
        let r = s.rotation + (ANGULAR_SPEED <= MAX_ROTATION ? ANGULAR_SPEED : Math.max(MAX_ROTATION - s.rotation, 0));
        s.rotation=r;
      };
      s.g.rotr= function(){
        let r = s.rotation - (ANGULAR_SPEED >= -MAX_ROTATION ? -ANGULAR_SPEED : Math.max(-MAX_ROTATION + s.rotation, 0));
        s.rotation=r;
      };
      s.g.onTarget=function(){
        s.g.landed=true;
      };
      s.g.look=function(){
        let dx= Math.abs(_G.target.x - s.x), dy = Math.abs(_G.target.y - s.y);
        let dist=Math.sqrt(dx*dx+dy*dy);
        return [this.calcSpeed(), s.rotation, dist];
      };
      s.g.think=function(){
        const inputs = this.look();
        const outputs = this.brain.compute(inputs);
        for (let i = 0; i < outputs.length; i++) {
          if (outputs[i] > 0.5) this.actions[i].call(s.g);
        }
      };
      s.g.calcScore=function(){
        let dx=_G.target.x-s.x, dy=_G.target.y-s.y;
        let dist=Math.sqrt(dx*dx,dy*dy);
        let angleDiff = 0;
        let penalty = 0;
        if(s.x < 0 || s.x > Mojo.width || s.y < 0 || s.y > Mojo.height){
          s.m5.dead=true;
          penalty = -60;
        }else if (_G.obstacles.find(o=> _S.hit(o,s))){
          s.m5.dead=true;
          penalty = -30;
        }
        return ( angleDiff * ANGLE_DIFF_WEIGHT +
                  this.fuel * FUEL_WEIGHT +
                  this.lastSpeed * SPEED_WEIGHT +
                  dist * TARGET_WEIGHT +
                  (s.g.landed ? LANDING_SCORE : 0) +
                   s.m5.dead ? penalty : 0);
      };

      s.g.actions = [s.g.thrust, s.g.rotl, s.g.rotr, () => {}];

      s.x=Mojo.width*0.2;
      s.y=s.height*1.5;
      s.g.lastPos=[s.x,s.y];
      return self.insert(s,true);
    }

		class ChromoNNet extends GA.Chromosome{
			#score;
			constructor(nn, calc, target){
				super(nn, calc, target);
				this.recalcScore();
			}
			getScore(){ return this.#score }
			updateScore(s){ this.#score=s; return this; }
			cmpScore(s){ return this.#score>s ? 1 : (this.#score<s? -1 : 0) }
			clone(){
				let [f,t]= this.getScoreCalcInfo();
				return new ChromoNNet(this.copyGenes(), f, t);
			}
      copyGenes(){
        return [this.getGeneAt(0).clone()];
      }
			compareTo(other){
				return this.cmpScore(other.getScore());
			}
    }

    function calcFit(genes){
      return 0;
    }

    function _crossOverFunc(p1,p2){
      let a= p1.getGeneAt(0).toJSON();
      let b= p2.getGeneAt(0).toJSON();
      _.assert(a.nodes.length==b.nodes.length, "wrong count of nodes");
      _.assert(a.links.length==b.links.length,"wrong count of links");
      let b_links_sorted= a.links.reduce((acc,k)=>{
        let g= b.links.find(o=> o.fromID==k.fromID && o.toID==k.toID);
        _.assert(g, "expected link in the other ChromoNNet not found");
        acc.push(g);
        return acc;
      },[]);
      let len=a.links.length, cp= _.randInt2(0,len);
      let b1=[],b2=[];
      for(let i=0; i<cp; ++i){
        b1.push(a.links[i]);
        b2.push(b_links_sorted[i]);
      }
      for(let i=cp; i<len; ++i){
        b1.push(b_links_sorted[i]);
        b2.push(a.links[i]);
      }
      _.assert(b1.length==a.links.length, "bad crossed over link genes");
      _.assert(b2.length==a.links.length, "bad crossed over link genes");
      _.append(a.links,b1,true);
      _.append(b.links,b2,true);
      let new_a= [NN.NeuralNet.fromJSON(a)];
      let new_b= [NN.NeuralNet.fromJSON(b)];
      return [new_a, new_b];
    }

    function _createFunc(arg){
      return arg ? new ChromoNNet(arg,calcFit) :
        new ChromoNNet([new NN.NeuralNet(INPUTS,OUTPUTS,{
          layers:[
            {size:8}
          ]
        })],calcFit);
    }

    function _mutateFunc(genes){
      if(_.rand() < Params.mutationRate){}else{return}
      let nn= genes[0];
      let fa, fb;
      nn.iterNodes((n)=>{
        if(_.rand() < Params.mutationRate && !fa){
          n.setBias(_.randMinus1To1());
          fa=true;
        }
        if(_.rand() < Params.mutationRate && !fb){
          n.iterOutLinks((k)=>{
            if (_.rand()< Params.mutationRate){
              k.weight=_.randMinus1To1();
              fb=true;
            }
          });
        }
      });
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
            this.neatObj= new GA.ChromoGA(POPSIZE, {
              create:_createFunc,
              mutate:_mutateFunc,
              crossOver:_crossOverFunc
            });
            this.ships.forEach(b=> _S.remove(b));
            this.ships= this.neatObj.createPhenotypes().map(g=> Ship(self,K,g));
            this.resetNext(true);
          },
          resetNext(skip){
            this.waitNextWave=30;
            this.bestCurScore=0;
            if(!skip){
              this.neatObj.epoch(this.ships.reduce((acc,s)=>{
                return acc.push(s.g.score) && _S.remove(s) && acc
              }, []));
              this.ships= this.neatObj.createPhenotypes().map(g=> Ship(self,K,g));
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



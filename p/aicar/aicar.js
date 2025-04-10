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
    const {Geo} = _S;

    ////////////////////////////////////////////////////////////////////////////
    const GA=window[ 1 ? "io/czlab/mcfud/algo/NEAT_Buckland" :
    "io/czlab/mcfud/algo/NEAT_CBullet"
    ]();
    const Core= window["io/czlab/mcfud/core"]();
    const int=Math.floor;

    GA.configParams({
      sigmoid:function(x){
        let a=Math.exp(x), b= Math.exp(-x);
				return (a-b)/(a+b);
      }
    });
    const
      UI_FONT=Mojo.DOKI_LOWER,
      SplashCfg= {
        title:"NEAT/AI Car",
        action: {name:"PlayGame"},
        clickSnd:"click.mp3",
      };

    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    const doBackDrop=(s)=> s.insert(_S.fillMax("bg.jpg"));
    const playClick=()=> Mojo.sound("click.mp3").play();
    const CLICK_DELAY=343;
    const SPAWN_TIME= 90;
    const INPUTS=5;
    const OUTPUTS=2;
    const POPSIZE=50;
    const ROWS=20, COLS=40, MaxTurnRate = 0.2;
    const HALF_PI = Math.PI/2, QUAD_PI = Math.PI/4, PI2  = Math.PI*2;
    const SENSORS= [ - HALF_PI,  - QUAD_PI, 0 , QUAD_PI, HALF_PI];


    ////////////////////////////////////////////////////////////////////////////
    function _randPos(s){
      let g=_G.grid[2][int(COLS/2)-1];
      _V.set(s,_M.ndiv(g.x1+g.x2,2), _M.ndiv(g.y1+g.y2,2));
      s.y -= s.height/2;
      return s;
    }

    ////////////////////////////////////////////////////////////////////////////
    function Car(scene,K,g){
      const s= _S.tint(_S.sprite("tank.png"),_S.SomeColors.white);
      _S.sizeXY(s,_G.tileW,_G.tileH);
      _S.centerAnchor(s);
      let h2=s.height/2, w2=s.width/2, d=Math.sqrt(w2*w2+h2*h2);
      s.g.diag=d;
      s.angle= 0;
      //matching SENSORS array
      s.g.sensors = SENSORS.map(s => 0);
      s.g.radarPoints=[h2,d,w2,d,h2];
      s.g.radarProj= 2;
      s.g.distance=0;
      s.g.score=0;
      s.g.ticks=0;
      s.g.brain=g;
      s.m5.speed=3;
      s.g.drawRadars=function(){
        let proj, px,py, rays= SENSORS.map(d=> d + s.rotation);
        rays.forEach((r,i)=>{
          proj= this.radarPoints[i] * (1 + this.radarProj);
          px= s.x + Math.cos(r) * proj;
          py= s.y + Math.sin(r) * proj;
          scene.g.dbg.moveTo(s.x, s.y);
          scene.g.dbg.lineTo(px, py);
          scene.g.dbg.circle(px, py, 2);
          scene.g.dbg.stroke({width:1, color:_S.color("red")});
        });
      };
      s.g.chkCollide=function(){
        if(s.m5.dead || _G.obstacles.find(o=> _S.hit(s, o))){
          s.m5.dead=true;
        }
      };
      s.g.chkRadarHit=function(lineStart, lineEnd, obstacles){
        return obstacles.find(o=>
          Geo.hitTestLinePolygon(lineStart, lineEnd,
                                 Geo.bodyWrap(_S.toPolygon(o),o.x,o.y))[0]);
      };
      s.g.preChk=function(c,e){
        return _G.obstacles.filter(o=> Geo.hitTestLinePolygon(c, e, Geo.bodyWrap(_S.toPolygon(o),o.x,o.y))[0])
      };
      s.g.chkRadar=function(c, r, proj){
        let nx = Math.cos(r),
            ny = Math.sin(r),
            pt = [c[0] + int(nx * proj),
                  c[1] + int(ny * proj) ],
            len= proj + proj * s.g.radarProj;
        let obstacles = this.preChk(c, [c[0] + int(nx * len), c[1] + int(ny * len)]);
        //console.log(`Found ${obstacles.length} obstacles instead of ${_G.obstacles.length}`);
        while(!this.chkRadarHit(c, pt,obstacles) && proj < len){
          proj+=1;
          pt[0] = s.x + int(nx * proj);
          pt[1] = s.y + int(ny * proj);
        }
        let dx = pt[0]-s.x, dy = pt[1]-s.y;
        return [pt, int(Math.sqrt(dx*dx + dy*dy))];
      };
      s.g.look=function(){
        let rays= SENSORS.map(d=> d + s.rotation);
        let c=[s.x,s.y];
        this.sensors.forEach((r,i,v)=> v[i]=0);
        rays.forEach((r,i)=> this.sensors[i]=this.chkRadar(c, r, this.radarPoints[i]));
        return this;
      };
      s.g.think=function(){
        let output = this.brain.update( this.sensors.map(o=>  o[1]/ _G.tileW ));
        if(output[0] > output[1])
          s.angle += 10;
        else
          s.angle -= 10;
        return this;
      };
      s.g.update=function(){
        s.x  += Math.cos(s.rotation) * s.m5.speed;
        s.y += Math.sin(s.rotation) * s.m5.speed;
        this.distance += s.m5.speed;
        this.ticks += 1;
        this.chkCollide();
        if(!s.m5.dead){
          this.score += this.getReward();
        }
        if(_G.showRadar){ this.drawRadars(); }
        return this;
      };
      s.g.getReward=function(){
        return this.distance / 50;
      };

      return scene.insert(_randPos(s));
    }

    ////////////////////////////////////////////////////////////////////////////
    /* */
    //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
    _Z.scene("PlayGame",{
      setup(){
        let self=this, K=Mojo.getScaleFactor();
        //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
        _.inject(this.g,{
          initTrackComplex(out){
            let grid=_S.gridXY([COLS,ROWS],0.75,0.75,out);
            let H=grid.length,W=grid[0].length;
            let g= grid[0][0], s, b, blocks=[];
            let tw=g.x2-g.x1, th=g.y2-g.y1, color="#737350";
            //color="#9E9D24";
            color="#000000";
            //top
            s= _S.rect(W*tw,th,color);
            _V.set(s, grid[0][0].x1,grid[0][0].y1);
            blocks.push(self.insert(s));
            //bottom
            s= _S.rect(W*tw,th,color);
            _V.set(s, grid[H-1][0].x1,grid[H-1][0].y1);
            blocks.push(self.insert(s));
            //left
            s= _S.rect(tw,H*th,color);
            _V.set(s, grid[0][0].x1,grid[0][0].y1);
            blocks.push(self.insert(s));
            //right
            s= _S.rect(tw,H*th,color);
            _V.set(s, grid[0][W-1].x1,grid[0][W-1].y1);
            blocks.push(self.insert(s));

            let cw=W-2-4, ch=H-2-4;
            s=_S.rect(tw*cw, th*4,color);
            _V.set(s, grid[2+1][2+1].x1,grid[2+1][2+1].y1);
            blocks.push(self.insert(s));
            s=_S.rect(tw*cw, th*4,color);
            _V.set(s, grid[H-2-1-4][2+1].x1,grid[H-2-1-4][2+1].y1);
            blocks.push(self.insert(s));

            s=_S.rect(tw*8, th*6,color);
            _V.set(s, grid[1+2+4][int(W/2)-4].x1,grid[1+2+4][int(W/2)-4].y1);
            blocks.push(self.insert(s));

            s=_S.rect(tw*(int(W/2)-7), th*2,color);
            _V.set(s, grid[1+2+4+2][1].x1,grid[1+2+4+2][1].y1);
            blocks.push(self.insert(s));

            s=_S.rect(tw*(int(W/2)-7), th*2,color);
            _V.set(s, grid[1+2+4+2][int(W/2)+6].x1,grid[1+2+4+2][int(W/2)+6].y1);
            blocks.push(self.insert(s));

            _G.obstacles=blocks;
            return grid;
          },
          initTrackSimple(out){
            let grid=_S.gridXY([COLS,ROWS],0.75,0.75,out);
            let H=grid.length,W=grid[0].length;
            let g= grid[0][0], s, b, blocks=[];
            let cw=W-2-4, ch=H-2-4;
            let tw=g.x2-g.x1, th=g.y2-g.y1, color="#737350";
            //top
            s= _S.rect(W*tw,th,color);
            _V.set(s, grid[0][0].x1,grid[0][0].y1);
            blocks.push(self.insert(s));
            //bottom
            s= _S.rect(W*tw,th,color);
            _V.set(s, grid[H-1][0].x1,grid[H-1][0].y1);
            blocks.push(self.insert(s));
            //left
            s= _S.rect(tw,H*th,color);
            _V.set(s, grid[0][0].x1,grid[0][0].y1);
            blocks.push(self.insert(s));
            //right
            s= _S.rect(tw,H*th,color);
            _V.set(s, grid[0][W-1].x1,grid[0][W-1].y1);
            blocks.push(self.insert(s));
            //center
            s=_S.rect(tw*cw, th*ch,color );
            _V.set(s, grid[2+1][2+1].x1,grid[2+1][2+1].y1);
            blocks.push(self.insert(s));
            _G.obstacles=blocks;
            return grid;
          },
          initLevel(){
            let out={}, g,gfx=_S.graphics(),
              grid=this.initTrackComplex(out), g0= grid[0][0];
            _S.drawGridBox(out,1,"white",gfx);
            _S.drawGridLines(0,0,grid,1,{color:"grey",alpha:0.1},gfx);
            self.insert(gfx);
            _.inject(_G,{
              arena:out,
              gen:1,
              grid,
              showRadar:false,
              remaining:0,
              tileW: g0.x2-g0.x1,
              tileH: g0.y2-g0.y1
            });
            this.initLevel2();
            this.dbg= self.insert(_S.graphics());
            return self.insert(_S.bboxFrame(out));
          },
          initLevel2(){
            this.spawnInterval = SPAWN_TIME;
            this.cars = [];
            this.interval = 0;
            this.waitNextWave=0;
            this.bestCurScore=0;
            this.neatObj= new GA.NeatGA(POPSIZE, INPUTS, OUTPUTS);
            this.cars= this.neatObj.createPhenotypes().map(g=> Car(self,K,g));
            this.resetNext(true);
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
            this.cars.forEach((b,i)=>{
              if(b.m5.dead){
                b.visible=false;
              }else{
                b.g.look().think().update();
                if(b.g.score>this.bestCurScore){
                  this.bestCurScore=b.g.score;
                }
              }
            });
            this.isItEnd() ? this.resetNext() : 0;
          },
          resetNext(skip){
            this.waitNextWave=30;
            this.bestCurScore=0;
            this.interval = 0;
            if(!skip){
              this.cars = this.neatObj.epoch(this.cars.reduce((acc,s)=>{
                return acc.push(s.g.score) && _S.remove(s) && acc
              }, [])).map(g=> Car(self,K,g));
            }
            _G.remaining=this.cars.reduce((acc,c)=> acc + (c.m5.dead?0:1),0);
          },
          isItEnd(){
            return this.cars.every(b=> b.m5.dead)
          }
        });
        //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
        doBackDrop(this);
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
        if(_I.keyDown(_I.SPACE)){
          _G.showRadar= !_G.showRadar;
        }
        _G.remaining=this.g.cars.reduce((acc,c)=> acc + (c.m5.dead?0:1),0);
        if(_G.remaining<=3){
          //this.g.cars.forEach(c=> c.m5.dead?0: _S.tint(c,"magenta"));
        }
        if(_G.remaining==1){
          //_G.showRadar=true;
        }
        this.g.dbg.clear();
        this.g.tick();
        this.g.genText.text= `Generation: ${this.g.neatObj.curGen()+1} - Score: ${this.g.bestCurScore}`;
      }
    });

    _Z.run("Splash", SplashCfg);
  }

  //;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;;
  //load and run
  MojoH5Ldr({
    assetFiles: ["tank.png","menu.png","bg.jpg","click.mp3"],
    arena: {width: 1344, height: 840},
    scaleToWindow:"max",
    scaleFit:"x",
    start(...args){ scenes(...args) }
  });

})(this);


